import DeviceActivity
import Foundation

final class FocusUpMonitor: DeviceActivityMonitor {
  override func intervalDidStart(for activity: DeviceActivityName) { super.intervalDidStart(for: activity); ProtectionShared.apply() }
  override func intervalDidEnd(for activity: DeviceActivityName) { super.intervalDidEnd(for: activity); ProtectionShared.apply() }
}
