package expo.modules.focusupprotection

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.view.accessibility.AccessibilityEvent

class FocusUpAccessibilityService : AccessibilityService() {
  companion object { @Volatile var running = false }
  private val handler = Handler(Looper.getMainLooper())
  private var foregroundPlatform: String? = null
  private var lastShieldAt = 0L
  private val check = object : Runnable { override fun run() { countUsage(); enforce(); handler.postDelayed(this, 2000) } }
  /** Two seconds of foreground time per tick, only while the screen is on and the app is not shielded. */
  private fun countUsage() {
    val platform = foregroundPlatform ?: return
    val screenOn = (getSystemService(POWER_SERVICE) as? PowerManager)?.isInteractive ?: true
    if (screenOn && !ProtectionPolicy.shouldBlock(this, platform)) ProtectionPolicy.addUsage(this, platform, 2)
  }
  override fun onServiceConnected() { running = true; handler.post(check) }
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    // Read packageName only. No node tree, labels, text, message data or screenshot access.
    foregroundPlatform = ProtectionPolicy.platformFor(event.packageName?.toString())
    enforce()
  }
  private fun enforce() {
    val platform = foregroundPlatform ?: return
    if (!ProtectionPolicy.shouldBlock(this, platform) || System.currentTimeMillis() - lastShieldAt < 1500) return
    lastShieldAt = System.currentTimeMillis()
    runCatching { startActivity(Intent(this, FocusUpShieldActivity::class.java).putExtra("platform", platform).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)) }
  }
  override fun onInterrupt() { }
  override fun onDestroy() { running = false; handler.removeCallbacks(check); super.onDestroy() }
}
