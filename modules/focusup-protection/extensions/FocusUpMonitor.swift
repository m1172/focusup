import DeviceActivity
import Foundation

final class FocusUpMonitor: DeviceActivityMonitor {
  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    // A new day starts each daily-limit interval: the app is open again.
    if let platform = limitPlatform(activity) { ProtectionShared.defaults?.removeObject(forKey: "limitReached.\(platform)") }
    ProtectionShared.apply()
  }
  override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
    super.eventDidReachThreshold(event, activity: activity)
    guard let platform = limitPlatform(activity) else { return }
    ProtectionShared.defaults?.set(ProtectionShared.dayKey(), forKey: "limitReached.\(platform)")
    ProtectionShared.apply()
  }
  private func limitPlatform(_ activity: DeviceActivityName) -> String? {
    let prefix = "focusup.limit."
    return activity.rawValue.hasPrefix(prefix) ? String(activity.rawValue.dropFirst(prefix.count)) : nil
  }
  override func intervalDidEnd(for activity: DeviceActivityName) { super.intervalDidEnd(for: activity); ProtectionShared.apply() }
  /// Breaks shorter than Apple's 15-minute minimum end at this warning.
  override func intervalWillEndWarning(for activity: DeviceActivityName) { super.intervalWillEndWarning(for: activity); ProtectionShared.apply() }
}
