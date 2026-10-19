package expo.modules.focusupprotection

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.graphics.Color
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ScrollView
import android.graphics.drawable.GradientDrawable

class FocusUpShieldActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private var platform = ""
  private val check = object : Runnable { override fun run() { if (!ProtectionPolicy.shouldBlock(this@FocusUpShieldActivity, platform)) finish() else handler.postDelayed(this, 1000) } }
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    platform = intent.getStringExtra("platform") ?: ""
    if (!ProtectionPolicy.shouldBlock(this, platform)) { finish(); return }
    if (platform == "instagram" || platform == "youtube") {
      // The original app remains covered by the persisted protection policy.
      // Show FocusUp's handoff page only when a protected native app is opened.
      val handoff = Intent(Intent.ACTION_VIEW, Uri.parse("focusup://native-app/$platform")).setPackage(packageName)
      if (runCatching { startActivity(handoff); true }.getOrDefault(false)) { finish(); return }
    }
    val locale = ProtectionPolicy.plan(this).optString("locale", "en")
    val title = if (locale == "uz") "Biroz to‘xtang" else if (locale == "ru") "Сделайте паузу" else "Take a moment"
    val explanation = if (locale == "uz") "Bu ilova FocusUp bilan himoyalangan. Tozalangan versiyani oching yoki vaqtinchalik kirishni tanlang." else if (locale == "ru") "Это приложение защищено FocusUp. Откройте чистую версию или выберите временный доступ." else "FocusUp is protecting this app. Open the cleaner version or choose temporary access."
    val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(48, 48, 48, 48); setBackgroundColor(Color.rgb(20, 18, 38)) }
    fun text(value: String, size: Float) { layout.addView(TextView(this).apply { this.text = value; textSize = size; setTextColor(Color.WHITE); gravity = Gravity.CENTER; setPadding(0, 18, 0, 18) }) }
    text("FocusUp", 18f); text(title, 30f); text(explanation, 17f)
    fun button(label: String, path: String) { layout.addView(Button(this).apply { this.text = label; setTextColor(Color.WHITE); background = GradientDrawable().apply { setColor(Color.rgb(108, 71, 255)); cornerRadius = 24f }; layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = 18 }; setOnClickListener { runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("focusup://$path")).setPackage(packageName)); finish() }.onFailure { goHome() } } }) }
    if (platform == "instagram" || platform == "youtube") button(if (locale == "uz") "FocusUp’da ochish" else if (locale == "ru") "Открыть в FocusUp" else "Open in FocusUp", "native-app/$platform")
    button(if (locale == "uz") "Vaqtinchalik kirish" else if (locale == "ru") "Временный доступ" else "Temporary access", "protection")
    layout.addView(Button(this).apply { text = if (locale == "uz") "Orqaga" else if (locale == "ru") "Назад" else "Go back"; setOnClickListener { goHome() } })
    layout.minimumHeight = resources.displayMetrics.heightPixels
    setContentView(ScrollView(this).apply { isFillViewport = true; addView(layout) }); handler.post(check)
  }
  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); platform = intent.getStringExtra("platform") ?: ""; recreate() }
  private fun goHome() { startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); finish() }
  @Deprecated("Deprecated in Java") override fun onBackPressed() { goHome() }
  override fun onDestroy() { handler.removeCallbacks(check); super.onDestroy() }
}
