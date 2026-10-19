package expo.modules.focusupprotection

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.webkit.CookieManager
import android.webkit.WebStorage
import android.webkit.WebView
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class FocusUpProtectionModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)
  private fun authorized(): Boolean {
    val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
    return manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK).any { it.resolveInfo.serviceInfo.packageName == context.packageName && it.resolveInfo.serviceInfo.name == FocusUpAccessibilityService::class.java.name }
  }
  override fun definition() = ModuleDefinition {
    Name("FocusUpProtection")
    AsyncFunction("getStatus") {
      val plan = ProtectionPolicy.plan(context)
      val count = plan.optJSONArray("baseline")?.length() ?: 0
      val protectedPlatforms = if (authorized() && FocusUpAccessibilityService.running) ProtectionPolicy.packages.keys.filter { ProtectionPolicy.shouldBlock(context, it) } else emptyList()
      mapOf("supported" to true, "authorized" to authorized(), "selectedCount" to count, "active" to protectedPlatforms.isNotEmpty(), "protectedPlatforms" to protectedPlatforms)
    }
    AsyncFunction("requestAuthorization") {
      if (!authorized()) context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      authorized()
    }
    AsyncFunction("selectApps") { platform: String ->
      val packageName = ProtectionPolicy.packages[platform]
      if (packageName == null) 0 else try { context.packageManager.getApplicationInfo(packageName, 0); 1 } catch (_: Exception) { 0 }
    }
    AsyncFunction("applyPlan") { json: String ->
      require(authorized()) { "authorizationRequired" }
      require(json.length < 100000) { "invalidPlan" }
      val plan = JSONObject(json)
      require(plan.optInt("schemaVersion") == 1 && (plan.optJSONArray("routines")?.length() ?: 0) <= 16) { "invalidPlan" }
      require(ProtectionPolicy.preferences(context).edit().putString("plan", json).commit()) { "storageUnavailable" }
    }
    AsyncFunction("clearBrowserData") { promise: Promise ->
      CookieManager.getInstance().removeAllCookies {
        CookieManager.getInstance().flush()
        WebStorage.getInstance().deleteAllData()
        WebView(context).apply { clearCache(true); clearHistory(); destroy() }
        promise.resolve(true)
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("hasUsageAccess") { UsageAccess.granted(context) }
    AsyncFunction("openUsageAccessSettings") { UsageAccess.openSettings(context); Unit }
    AsyncFunction("getAppUsage") { days: Int -> UsageAccess.dailyAverages(context, days) }
    AsyncFunction("reset") { ProtectionPolicy.preferences(context).edit().clear().commit(); Unit }
  }
}
