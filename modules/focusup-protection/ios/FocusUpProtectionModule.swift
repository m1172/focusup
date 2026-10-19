import ExpoModulesCore
import Foundation
import UIKit
import FamilyControls
import ManagedSettings
import DeviceActivity
import SwiftUI
import WebKit
import ActivityKit

struct ProtectionPicker: View {
  @State var selection: FamilyActivitySelection
  let finish: (FamilyActivitySelection?) -> Void
  let locale: String
  var body: some View {
    NavigationStack { FamilyActivityPicker(selection: $selection).navigationTitle("FocusUp").toolbar {
      ToolbarItem(placement: .cancellationAction) { Button(locale == "uz" ? "Bekor qilish" : locale == "ru" ? "Отмена" : "Cancel") { finish(nil) } }
      ToolbarItem(placement: .confirmationAction) { Button(locale == "uz" ? "Saqlash" : locale == "ru" ? "Сохранить" : "Save") { finish(selection) } }
    } }
  }
}

public class FocusUpProtectionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FocusUpProtection")
    AsyncFunction("consumePendingLaunch") { () -> String in
      guard let defaults = ProtectionShared.defaults else { return "" }
      guard let request = defaults.dictionary(forKey: "pendingNativeAppLaunch") else { return "" }
      defaults.removeObject(forKey: "pendingNativeAppLaunch")
      guard let target = request["platform"] as? String, ["instagram", "youtube", "protection"].contains(target),
        let createdAt = request["createdAt"] as? Double,
        Date().timeIntervalSince1970 - createdAt >= 0, Date().timeIntervalSince1970 - createdAt <= 300 else { return "" }
      return target
    }.runOnQueue(.main)
    AsyncFunction("getStatus") { () -> [String: Any] in
      #if targetEnvironment(simulator)
      let supported = false
      #else
      ProtectionShared.apply()
      let supported = ProtectionShared.defaults != nil
      #endif
      let keys = ProtectionShared.defaults?.dictionaryRepresentation().keys.filter { $0.hasPrefix("selection.") && $0 != "selection.__allowed" } ?? []
      let count = keys.reduce(0) { sum, key in let selected = ProtectionShared.selection(String(key.dropFirst(10))); return sum + selected.applicationTokens.count + selected.categoryTokens.count + selected.webDomainTokens.count }
      let allowed = ProtectionShared.selection("__allowed").applicationTokens
      let protectedPlatforms = AuthorizationCenter.shared.authorizationStatus == .approved ? ProtectionShared.platforms().filter { platform in let selected = ProtectionShared.selection(platform); return !selected.applicationTokens.subtracting(allowed).isEmpty || !selected.categoryTokens.isEmpty || !selected.webDomainTokens.isEmpty } : []
      return ["supported": supported, "authorized": AuthorizationCenter.shared.authorizationStatus == .approved, "selectedCount": count, "active": !protectedPlatforms.isEmpty, "protectedPlatforms": Array(protectedPlatforms)]
    }
    AsyncFunction("requestAuthorization") { () async -> Bool in
      do { try await AuthorizationCenter.shared.requestAuthorization(for: .individual); return AuthorizationCenter.shared.authorizationStatus == .approved } catch { return false }
    }
    AsyncFunction("selectApps") { (platform: String, promise: Promise) in
      guard ["instagram", "youtube", "tiktok", "snapchat", "x", "facebook", "linkedin", "reddit", "__allowed"].contains(platform), let controller = self.appContext?.utilities?.currentViewController() else { promise.resolve(0); return }
      var pickerController: UIViewController?
      var initial = ProtectionShared.selection(platform)
      if platform == "__allowed" { let tokens = initial.applicationTokens; initial = FamilyActivitySelection(includeEntireCategory: false); initial.applicationTokens = tokens }
      let view = ProtectionPicker(selection: initial, finish: { selection in
        if var selection = selection {
          if platform == "__allowed" { let tokens = selection.applicationTokens; selection = FamilyActivitySelection(includeEntireCategory: false); selection.applicationTokens = tokens }
          if let data = try? JSONEncoder().encode(selection) { ProtectionShared.defaults?.set(data, forKey: "selection.\(platform)") }
        }
        pickerController?.dismiss(animated: true)
        let selected = ProtectionShared.selection(platform)
        promise.resolve(selected.applicationTokens.count + selected.categoryTokens.count + selected.webDomainTokens.count)
      }, locale: ProtectionShared.plan()?.locale ?? "en")
      pickerController = UIHostingController(rootView: view)
      pickerController?.isModalInPresentation = true
      if let pickerController = pickerController { controller.present(pickerController, animated: true) }
    }.runOnQueue(.main)
    AsyncFunction("applyPlan") { (json: String) async throws in
      guard AuthorizationCenter.shared.authorizationStatus == .approved, let data = json.data(using: .utf8), data.count < 100_000 else { throw NSError(domain: "FocusUp", code: 1) }
      let plan = try JSONDecoder().decode(ProtectionPlan.self, from: data)
      guard plan.schemaVersion == 1, plan.routines.count <= 16 else { throw NSError(domain: "FocusUp", code: 2) }
      let previous = ProtectionShared.plan()
      do { try ProtectionShared.register(plan) } catch { if let previous = previous { try? ProtectionShared.register(previous) }; throw error }
      ProtectionShared.defaults?.set(data, forKey: "plan")
      ProtectionShared.apply()
      await self.updateActivity(plan)
    }
    AsyncFunction("clearBrowserData") { (promise: Promise) in
      let store = WKWebsiteDataStore.default()
      HTTPCookieStorage.shared.cookies?.forEach { HTTPCookieStorage.shared.deleteCookie($0) }
      URLCache.shared.removeAllCachedResponses()
      store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) { promise.resolve(true) }
    }.runOnQueue(.main)
    AsyncFunction("reset") { () async in
      let center = DeviceActivityCenter(); center.stopMonitoring(center.activities.filter { $0.rawValue.hasPrefix("focusup.") })
      ProtectionShared.store.clearAllSettings()
      if let defaults = ProtectionShared.defaults { for key in defaults.dictionaryRepresentation().keys where key == "plan" || key == "pendingNativeAppLaunch" || key.hasPrefix("selection.") { defaults.removeObject(forKey: key) } }
      for activity in Activity<FocusUpActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
    }
  }
  private func updateActivity(_ plan: ProtectionPlan) async {
    for activity in Activity<FocusUpActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
    guard plan.liveActivity, ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    let temporary = plan.temporary, strict = plan.strict
    guard let endsAt = strict?.endsAt ?? temporary?.endsAt, endsAt > Date().timeIntervalSince1970 * 1000 else { return }
    let title: String = strict != nil ? (plan.locale == "uz" ? "Qattiq rejim" : plan.locale == "ru" ? "Строгий режим" : "Strict Mode") : (plan.locale == "uz" ? "Vaqtinchalik kirish" : plan.locale == "ru" ? "Временный доступ" : "Temporary Access")
    let date = Date(timeIntervalSince1970: endsAt / 1000)
    _ = try? Activity.request(attributes: FocusUpActivityAttributes(brand: "FocusUp"), content: ActivityContent(state: .init(title: title, endsAt: date), staleDate: date), pushType: nil)
  }
}
