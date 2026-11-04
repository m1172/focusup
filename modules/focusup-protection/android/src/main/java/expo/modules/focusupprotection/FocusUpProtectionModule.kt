package expo.modules.focusupprotection

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class FocusUpProtectionModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)
  private val siteDomains = setOf("instagram.com")
  private fun siteCookies(domain: String): List<Pair<String, String>> =
    (CookieManager.getInstance().getCookie("https://www.$domain") ?: "").split(";").map { it.trim() }.filter { it.contains('=') }
      .map { it.substringBefore('=') to it.substringAfter('=') }
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
    // The in-app browser's account switcher saves and restores a site's sign-in cookies. Only listed sites are touched.
    // Android's CookieManager returns names and values only, so restored cookies get the site's domain, path "/" and Secure.
    AsyncFunction("getSiteCookies") { domain: String ->
      val array = JSONArray()
      if (domain in siteDomains) siteCookies(domain).forEach { (name, value) ->
        array.put(JSONObject().put("name", name).put("value", value).put("domain", ".$domain").put("path", "/").put("secure", true).put("httpOnly", false))
      }
      array.toString()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("setSiteCookies") { domain: String, json: String ->
      if (domain !in siteDomains || json.length >= 200000) return@AsyncFunction false
      val manager = CookieManager.getInstance()
      val items = JSONArray(json)
      for (index in 0 until minOf(items.length(), 100)) {
        val item = items.optJSONObject(index) ?: continue
        val name = item.optString("name")
        val value = item.optString("value")
        val cookieDomain = item.optString("domain").trimStart('.')
        if (name.isEmpty() || listOf(name, value).any { it.contains(';') || it.contains('\n') }) continue
        if (cookieDomain != domain && !cookieDomain.endsWith(".$domain")) continue
        val expires = item.optDouble("expires", Double.NaN)
        val maxAge = if (expires.isNaN()) 31536000L else ((expires - System.currentTimeMillis()) / 1000).toLong()
        if (maxAge <= 0) continue
        manager.setCookie("https://www.$domain", "$name=$value; Domain=.$domain; Path=/; Secure; Max-Age=$maxAge")
      }
      manager.flush()
      true
    }.runOnQueue(Queues.MAIN)
    // The web view's own user agent (System "http.agent" is a different, non-browser string).
    AsyncFunction("getWebViewUserAgent") { WebSettings.getDefaultUserAgent(context) }
    AsyncFunction("clearSiteData") { domain: String ->
      if (domain !in siteDomains) return@AsyncFunction false
      val manager = CookieManager.getInstance()
      siteCookies(domain).forEach { (name, _) ->
        manager.setCookie("https://www.$domain", "$name=; Domain=.$domain; Path=/; Max-Age=0")
        manager.setCookie("https://www.$domain", "$name=; Path=/; Max-Age=0")
      }
      manager.flush()
      WebStorage.getInstance().deleteOrigin("https://www.$domain")
      WebStorage.getInstance().deleteOrigin("https://$domain")
      true
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("hasUsageAccess") { UsageAccess.granted(context) }
    AsyncFunction("openUsageAccessSettings") { UsageAccess.openSettings(context); Unit }
    AsyncFunction("getAppUsage") { days: Int -> UsageAccess.dailyAverages(context, days) }
    AsyncFunction("reset") { ProtectionPolicy.preferences(context).edit().clear().commit(); Unit }
  }
}
