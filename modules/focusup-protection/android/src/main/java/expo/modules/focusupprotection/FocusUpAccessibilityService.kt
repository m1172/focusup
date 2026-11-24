package expo.modules.focusupprotection

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast

class FocusUpAccessibilityService : AccessibilityService() {
  companion object { @Volatile var running = false }
  private val handler = Handler(Looper.getMainLooper())
  private var foregroundPlatform: String? = null
  private var lastShieldAt = 0L
  private var lastFeedCheckAt = 0L
  private var lastLeaveAt = 0L
  private var lastNoticeAt = 0L
  private val check = object : Runnable { override fun run() { countUsage(); enforce(); checkFeed(force = true); handler.postDelayed(this, 2000) } }
  /** Two seconds of foreground time per tick, only while the screen is on and the app is not shielded. */
  private fun countUsage() {
    val platform = foregroundPlatform ?: return
    val screenOn = (getSystemService(POWER_SERVICE) as? PowerManager)?.isInteractive ?: true
    if (screenOn && !ProtectionPolicy.shouldBlock(this, platform)) ProtectionPolicy.addUsage(this, platform, 2)
  }
  override fun onServiceConnected() { running = true; handler.post(check) }
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    event ?: return
    if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
      foregroundPlatform = ProtectionPolicy.platformFor(event.packageName?.toString())
      enforce()
      checkFeed(force = true)
      return
    }
    // Content changes and scrolling: only inside an app whose short-video screen is blocked.
    if (ProtectionPolicy.platformFor(event.packageName?.toString()) == foregroundPlatform) checkFeed(force = false)
  }
  private fun enforce() {
    val platform = foregroundPlatform ?: return
    if (!ProtectionPolicy.shouldBlock(this, platform) || System.currentTimeMillis() - lastShieldAt < 1500) return
    lastShieldAt = System.currentTimeMillis()
    runCatching { startActivity(Intent(this, FocusUpShieldActivity::class.java).putExtra("platform", platform).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)) }
  }
  /**
   * Feeds-only apps: if a Reels/Shorts screen is visible, go back so the rest of the app stays usable.
   * Only view IDs are compared; no text, messages or images are read, and nothing is stored.
   */
  private fun checkFeed(force: Boolean) {
    val platform = foregroundPlatform ?: return
    val now = System.currentTimeMillis()
    if (!force && now - lastFeedCheckAt < 350) return
    lastFeedCheckAt = now
    if (!ProtectionPolicy.blocksFeed(this, platform, now)) return
    val screens = ProtectionPolicy.feedScreens(this, platform)
    if (screens.isEmpty()) return
    val root = rootInActiveWindow ?: return
    if (ProtectionPolicy.platformFor(root.packageName?.toString()) != platform) return
    val onFeed = screens.any { id -> runCatching { root.findAccessibilityNodeInfosByViewId(id).any { it.isVisibleToUser } }.getOrDefault(false) }
    if (!onFeed || now - lastLeaveAt < 800) return
    lastLeaveAt = now
    performGlobalAction(GLOBAL_ACTION_BACK)
    val notice = ProtectionPolicy.feedNotice(this)
    if (notice.isNotEmpty() && now - lastNoticeAt > 4000) { lastNoticeAt = now; Toast.makeText(this, notice, Toast.LENGTH_SHORT).show() }
  }
  override fun onInterrupt() { }
  override fun onDestroy() { running = false; handler.removeCallbacks(check); super.onDestroy() }
}
