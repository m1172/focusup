import ManagedSettings
import FamilyControls
import Foundation

final class FocusUpShieldAction: ShieldActionDelegate {
  private var defaults: UserDefaults? {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "FocusUpAppGroup") as? String else { return nil }
    return UserDefaults(suiteName: group)
  }

  // Only the user's labelled selection identifies a platform. Opaque Apple tokens never enter JavaScript.
  private func destination(application: ApplicationToken? = nil, category: ActivityCategoryToken? = nil, domain: WebDomainToken? = nil) -> String {
    for platform in ["instagram", "youtube"] {
      guard let data = defaults?.data(forKey: "selection.\(platform)"), let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else { continue }
      if let application = application, selection.applicationTokens.contains(application) { return platform }
      if let category = category, selection.categoryTokens.contains(category) { return platform }
      if let domain = domain, selection.webDomainTokens.contains(domain) { return platform }
    }
    return "protection"
  }

  // The shield is styled as FocusUp's handoff page; its one button opens the website in FocusUp directly.
  // FocusUp reads the request once when it comes to the foreground.
  private func respond(to action: ShieldAction, destination: String, completion: @escaping (ShieldActionResponse) -> Void) {
    guard let defaults = defaults else { completion(.close); return }
    if #available(iOS 26.5, *) {
      guard action == .primaryButtonPressed else { completion(.close); return }
      let target = destination == "protection" ? destination : "\(destination):open"
      defaults.set(["platform": target, "createdAt": Date().timeIntervalSince1970], forKey: "pendingNativeAppLaunch")
      completion(.openParentalControlsApp)
    } else {
      // Older iOS versions require the user to open FocusUp from their Home Screen; it then shows the handoff page.
      if action == .primaryButtonPressed { defaults.set(["platform": destination, "createdAt": Date().timeIntervalSince1970], forKey: "pendingNativeAppLaunch") }
      completion(.close)
    }
  }

  override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
    respond(to: action, destination: destination(application: application), completion: completionHandler)
  }
  override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
    respond(to: action, destination: destination(domain: webDomain), completion: completionHandler)
  }
  override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
    respond(to: action, destination: destination(category: category), completion: completionHandler)
  }
}
