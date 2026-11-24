package expo.modules.focusupprotection

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import androidx.webkit.CookieManagerCompat
import androidx.webkit.WebStorageCompat
import androidx.webkit.WebViewFeature
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
      val protectedPlatforms = if (authorized() && FocusUpAccessibilityService.running) ProtectionPolicy.packages.keys.filter { ProtectionPolicy.shouldBlock(context, it) || ProtectionPolicy.blocksFeed(context, it) } else emptyList()
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
    Function("supportsSecureCookies") { WebViewFeature.isFeatureSupported(WebViewFeature.GET_COOKIE_INFO) && WebViewFeature.isFeatureSupported(WebViewFeature.DELETE_BROWSING_DATA) }
    AsyncFunction("getSiteCookies") { domain: String ->
      require(domain in siteDomains && WebViewFeature.isFeatureSupported(WebViewFeature.GET_COOKIE_INFO)) { "secureCookiesUnavailable" }
      val cookies = CookieManagerCompat.getCookieInfo(CookieManager.getInstance(), "https://www.$domain/")
      val array = JSONArray()
      cookies.forEach { original ->
        val raw = SecureCookieSnapshot.normalize(original, domain)
        val pair = raw.substringBefore(';').split('=', limit = 2)
        require(pair.size == 2 && !raw.contains('\r') && !raw.contains('\n')) { "invalidCookie" }
        array.put(JSONObject().put("name", pair[0]).put("value", pair[1]).put("domain", domain).put("raw", raw))
      }
      array.toString()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("setSiteCookies") { domain: String, json: String, promise: Promise ->
      require(domain in siteDomains && json.length < 200000 && WebViewFeature.isFeatureSupported(WebViewFeature.GET_COOKIE_INFO)) { "secureCookiesUnavailable" }
      val items = JSONArray(json)
      require(items.length() <= 100) { "invalidCookies" }
      val cookies = (0 until items.length()).map { index ->
        val item = items.getJSONObject(index)
        val raw = SecureCookieSnapshot.normalize(item.getString("raw"), domain)
        require(raw.length < 16000 && !raw.contains('\r') && !raw.contains('\n')) { "invalidCookie" }
        val pieces = raw.split(';')
        require(pieces[0] == "${item.getString("name")}=${item.getString("value")}") { "invalidCookie" }
        pieces.drop(1).forEach { attribute ->
          val fields = attribute.trim().split('=', limit = 2)
          if (fields[0].equals("domain", ignoreCase = true)) {
            val host = fields.getOrElse(1) { "" }.trim().trimStart('.').lowercase()
            require(host == domain || host.endsWith(".$domain")) { "invalidCookieDomain" }
          }
        }
        raw
      }
      val manager = CookieManager.getInstance()
      if (cookies.isEmpty()) promise.resolve(true)
      else {
        var pending = cookies.size
        var success = true
        cookies.forEach { raw -> manager.setCookie("https://www.$domain/", raw) { accepted ->
          success = success && accepted
          pending -= 1
          if (pending == 0) { manager.flush(); promise.resolve(success) }
        } }
      }
    }.runOnQueue(Queues.MAIN)
    // The web view's own user agent (System "http.agent" is a different, non-browser string).
    AsyncFunction("getWebViewUserAgent") { WebSettings.getDefaultUserAgent(context) }
    AsyncFunction("clearSiteData") { domain: String, promise: Promise ->
      require(domain in siteDomains && WebViewFeature.isFeatureSupported(WebViewFeature.DELETE_BROWSING_DATA)) { "secureCookiesUnavailable" }
      WebStorageCompat.deleteBrowsingDataForSite(WebStorage.getInstance(), domain) { promise.resolve(true) }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("hasUsageAccess") { UsageAccess.granted(context) }
    AsyncFunction("openUsageAccessSettings") { UsageAccess.openSettings(context); Unit }
    AsyncFunction("getAppUsage") { days: Int -> UsageAccess.dailyAverages(context, days) }
    // Battery saving and auto-start on Xiaomi, Samsung and others (see BackgroundAccess).
    AsyncFunction("getBackgroundStatus") {
      mapOf("batteryRestricted" to BackgroundAccess.batteryRestricted(context), "hasAutoStart" to BackgroundAccess.hasAutoStartSettings(), "maker" to BackgroundAccess.maker())
    }
    AsyncFunction("openBatterySettings") { BackgroundAccess.openBatterySettings(context) }
    AsyncFunction("openAutoStartSettings") { BackgroundAccess.openAutoStartSettings(context) }
    AsyncFunction("reset") { ProtectionPolicy.preferences(context).edit().clear().commit(); Unit }
  }
}
