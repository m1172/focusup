import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity

struct ProtectionRoutine: Codable {
  let id: String
  let enabled: Bool
  let start: String
  let end: String
  let weekdays: [Int]
  let apps: [String]
  let allowedApps: [String]?
  let strict: Bool?
}
struct ProtectionInterval: Codable { let startedAt: Double; let endsAt: Double; let platforms: [String] }
struct TemporaryWindow: Codable { let platform: String; let startedAt: Double; let endsAt: Double }
struct ProtectionPlan: Codable {
  let schemaVersion: Int
  let locale: String
  let liveActivity: Bool
  let baseline: [String]
  let routines: [ProtectionRoutine]
  let strict: ProtectionInterval?
  let temporary: TemporaryWindow?
}

enum ProtectionShared {
  static var defaults: UserDefaults? {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "FocusUpAppGroup") as? String else { return nil }
    return UserDefaults(suiteName: group)
  }
  static let store = ManagedSettingsStore(named: .init("focusup"))
  static func plan() -> ProtectionPlan? {
    guard let data = defaults?.data(forKey: "plan") else { return nil }
    return try? JSONDecoder().decode(ProtectionPlan.self, from: data)
  }
  static func selection(_ platform: String) -> FamilyActivitySelection {
    guard let data = defaults?.data(forKey: "selection.\(platform)"), let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else { return FamilyActivitySelection(includeEntireCategory: true) }
    return selection
  }
  static func minutes(_ clock: String) -> Int { let parts = clock.split(separator: ":").compactMap { Int($0) }; return parts.count == 2 ? parts[0] * 60 + parts[1] : -1 }
  static func active(_ routine: ProtectionRoutine, at date: Date) -> Bool {
    guard routine.enabled else { return false }
    let c = Calendar.current.dateComponents([.weekday, .hour, .minute], from: date)
    let day = (c.weekday ?? 1) - 1, minute = (c.hour ?? 0) * 60 + (c.minute ?? 0)
    let start = minutes(routine.start), end = minutes(routine.end)
    guard start >= 0, end >= 0, start != end else { return false }
    if start < end { return routine.weekdays.contains(day) && minute >= start && minute < end }
    return (minute >= start && routine.weekdays.contains(day)) || (minute < end && routine.weekdays.contains((day + 6) % 7))
  }
  static func platforms(at date: Date = Date()) -> Set<String> {
    guard let plan = plan() else { return [] }
    var result = Set(plan.baseline)
    for routine in plan.routines where active(routine, at: date) { result.formUnion(Set(routine.apps).subtracting(routine.allowedApps ?? [])) }
    let now = date.timeIntervalSince1970 * 1000
    if let temporary = plan.temporary, temporary.endsAt > now { result.remove(temporary.platform) }
    for routine in plan.routines where routine.strict == true && active(routine, at: date) { result.formUnion(Set(routine.apps).subtracting(routine.allowedApps ?? [])) }
    if let strict = plan.strict, strict.endsAt > now { result.formUnion(strict.platforms) }
    return result
  }
  static func apply() {
    guard AuthorizationCenter.shared.authorizationStatus == .approved else { store.clearAllSettings(); return }
    var applications = Set<ApplicationToken>(), categories = Set<ActivityCategoryToken>(), domains = Set<WebDomainToken>()
    for platform in platforms() {
      let selected = selection(platform)
      applications.formUnion(selected.applicationTokens); categories.formUnion(selected.categoryTokens); domains.formUnion(selected.webDomainTokens)
    }
    let allowedApplications = selection("__allowed").applicationTokens
    // Opaque Apple tokens never leave the App Group or enter the JS/analytics bridge.
    applications.subtract(allowedApplications)
    store.shield.applications = applications.isEmpty ? nil : applications
    store.shield.applicationCategories = categories.isEmpty ? nil : .specific(categories, except: allowedApplications)
    store.shield.webDomains = domains.isEmpty ? nil : domains
  }
  static func register(_ plan: ProtectionPlan) throws {
    let center = DeviceActivityCenter()
    center.stopMonitoring(center.activities.filter { $0.rawValue.hasPrefix("focusup.") })
    for (index, routine) in plan.routines.enumerated() where routine.enabled {
      let start = minutes(routine.start), end = minutes(routine.end)
      let length = (end - start + 1440) % 1440
      guard start >= 0, end >= 0, length >= 15 else { throw NSError(domain: "FocusUp", code: 15) }
      try center.startMonitoring(.init("focusup.routine.\(index)"), during: DeviceActivitySchedule(intervalStart: DateComponents(hour: start / 60, minute: start % 60), intervalEnd: DateComponents(hour: end / 60, minute: end % 60), repeats: true))
    }
    func registerInterval(_ name: String, _ start: Double, _ end: Double) throws {
      guard end > Date().timeIntervalSince1970 * 1000 else { return }
      guard end - start >= 15 * 60 * 1000 else { throw NSError(domain: "FocusUp", code: 15) }
      let components: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
      try center.startMonitoring(.init(name), during: DeviceActivitySchedule(intervalStart: Calendar.current.dateComponents(components, from: Date(timeIntervalSince1970: start / 1000)), intervalEnd: Calendar.current.dateComponents(components, from: Date(timeIntervalSince1970: end / 1000)), repeats: false))
    }
    if let strict = plan.strict, !strict.platforms.isEmpty { try registerInterval("focusup.strict", strict.startedAt, strict.endsAt) }
    if let temporary = plan.temporary { try registerInterval("focusup.temporary", temporary.startedAt, temporary.endsAt) }
  }
}
