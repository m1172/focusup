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
    NavigationStack { FamilyActivityPicker(selection: $selection).navigationTitle("Vaqtim").toolbar {
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
      guard let target = request["platform"] as? String, ["instagram", "youtube", "tiktok", "protection", "instagram:open", "instagram:link", "youtube:open", "youtube:link", "tiktok:open", "tiktok:link"].contains(target),
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
      // Platforms the user has picked in Apple's list, whether or not the plan protects them right now.
      let selectedPlatforms = ["instagram", "youtube", "tiktok", "snapchat", "x", "facebook", "linkedin", "reddit"].filter { platform in let selected = ProtectionShared.selection(platform); return !selected.applicationTokens.isEmpty || !selected.categoryTokens.isEmpty || !selected.webDomainTokens.isEmpty }
      return ["supported": supported, "authorized": AuthorizationCenter.shared.authorizationStatus == .approved, "selectedCount": count, "active": !protectedPlatforms.isEmpty, "protectedPlatforms": Array(protectedPlatforms), "selectedPlatforms": selectedPlatforms]
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
    // The in-app browser's account switcher saves and restores a site's sign-in cookies. Only listed sites are touched.
    AsyncFunction("getSiteCookies") { (domain: String, promise: Promise) in
      guard FocusUpProtectionModule.siteDomains.contains(domain) else { promise.resolve("[]"); return }
      WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
        let items = cookies.filter { FocusUpProtectionModule.cookie($0.domain, belongsTo: domain) }.map { cookie -> [String: Any] in
          var item: [String: Any] = ["name": cookie.name, "value": cookie.value, "domain": cookie.domain, "path": cookie.path, "secure": cookie.isSecure, "httpOnly": cookie.isHTTPOnly]
          if let expires = cookie.expiresDate { item["expires"] = expires.timeIntervalSince1970 * 1000 }
          if let sameSite = cookie.sameSitePolicy { item["sameSite"] = sameSite.rawValue }
          return item
        }
        let data = (try? JSONSerialization.data(withJSONObject: items)) ?? Data("[]".utf8)
        promise.resolve(String(data: data, encoding: .utf8) ?? "[]")
      }
    }.runOnQueue(.main)
    AsyncFunction("setSiteCookies") { (domain: String, json: String, promise: Promise) in
      guard FocusUpProtectionModule.siteDomains.contains(domain), json.utf8.count < 200_000, let data = json.data(using: .utf8),
        let items = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] else { promise.resolve(false); return }
      let store = WKWebsiteDataStore.default().httpCookieStore
      let group = DispatchGroup()
      for item in items.prefix(100) {
        guard let name = item["name"] as? String, let value = item["value"] as? String, let cookieDomain = item["domain"] as? String,
          !name.isEmpty, FocusUpProtectionModule.cookie(cookieDomain, belongsTo: domain) else { continue }
        var properties: [HTTPCookiePropertyKey: Any] = [.name: name, .value: value, .domain: cookieDomain, .path: (item["path"] as? String) ?? "/"]
        if (item["secure"] as? Bool) == true { properties[.secure] = "TRUE" }
        if (item["httpOnly"] as? Bool) == true { properties[HTTPCookiePropertyKey("HttpOnly")] = "TRUE" }
        if let expires = item["expires"] as? Double {
          guard expires > Date().timeIntervalSince1970 * 1000 else { continue }
          properties[.expires] = Date(timeIntervalSince1970: expires / 1000)
        }
        if let sameSite = item["sameSite"] as? String { properties[.sameSitePolicy] = sameSite }
        guard let cookie = HTTPCookie(properties: properties) else { continue }
        group.enter()
        store.setCookie(cookie) { group.leave() }
      }
      group.notify(queue: .main) { promise.resolve(true) }
    }.runOnQueue(.main)
    AsyncFunction("clearSiteData") { (domain: String, promise: Promise) in
      guard FocusUpProtectionModule.siteDomains.contains(domain) else { promise.resolve(false); return }
      let dataStore = WKWebsiteDataStore.default()
      dataStore.httpCookieStore.getAllCookies { cookies in
        let group = DispatchGroup()
        for cookie in cookies where FocusUpProtectionModule.cookie(cookie.domain, belongsTo: domain) {
          group.enter()
          dataStore.httpCookieStore.delete(cookie) { group.leave() }
        }
        // Stored page data (local storage, IndexedDB, caches) belongs to the signed-in account too.
        var types = WKWebsiteDataStore.allWebsiteDataTypes()
        types.remove(WKWebsiteDataTypeCookies)
        group.enter()
        dataStore.fetchDataRecords(ofTypes: types) { records in
          let site = records.filter { FocusUpProtectionModule.cookie($0.displayName, belongsTo: domain) }
          dataStore.removeData(ofTypes: types, for: site) { group.leave() }
        }
        group.notify(queue: .main) { promise.resolve(true) }
      }
    }.runOnQueue(.main)
    AsyncFunction("reset") { () async in
      let center = DeviceActivityCenter(); center.stopMonitoring(center.activities.filter { $0.rawValue.hasPrefix("focusup.") })
      ProtectionShared.store.clearAllSettings()
      if let defaults = ProtectionShared.defaults { for key in defaults.dictionaryRepresentation().keys where key == "plan" || key == "pendingNativeAppLaunch" || key.hasPrefix("selection.") || key.hasPrefix("limitReached.") { defaults.removeObject(forKey: key) } }
      for activity in Activity<FocusUpActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
    }
  }
  private static let siteDomains: Set<String> = ["instagram.com"]
  /** True for `instagram.com`, `.instagram.com` and `www.instagram.com`, not for `notinstagram.com`. */
  private static func cookie(_ cookieDomain: String, belongsTo domain: String) -> Bool {
    let host = cookieDomain.hasPrefix(".") ? String(cookieDomain.dropFirst()) : cookieDomain
    return host == domain || host.hasSuffix("." + domain)
  }
  private func updateActivity(_ plan: ProtectionPlan) async {
    for activity in Activity<FocusUpActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
    guard plan.liveActivity, ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    let temporary = plan.temporary, strict = plan.strict
    guard let endsAt = strict?.endsAt ?? temporary?.endsAt, endsAt > Date().timeIntervalSince1970 * 1000 else { return }
    let title: String = strict != nil ? (plan.locale == "uz" ? "Qattiq rejim" : plan.locale == "ru" ? "Строгий режим" : "Strict Mode") : (plan.locale == "uz" ? "Vaqtinchalik kirish" : plan.locale == "ru" ? "Временный доступ" : "Temporary Access")
    let date = Date(timeIntervalSince1970: endsAt / 1000)
    _ = try? Activity.request(attributes: FocusUpActivityAttributes(brand: "Vaqtim"), content: ActivityContent(state: .init(title: title, endsAt: date), staleDate: date), pushType: nil)
  }
}
