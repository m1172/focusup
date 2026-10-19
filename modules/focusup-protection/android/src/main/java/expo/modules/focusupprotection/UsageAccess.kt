package expo.modules.focusupprotection

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import kotlin.math.ceil

/**
 * Reads per-app foreground time through UsageStatsManager. Needs the "Usage access" special
 * permission (PACKAGE_USAGE_STATS), which the user grants on a system Settings screen.
 * Only the onboarding apps are reported; nothing leaves the device.
 */
object UsageAccess {
  private const val DAY_MS = 24L * 60 * 60 * 1000
  private val tracked = listOf("instagram", "youtube", "tiktok")

  fun granted(context: Context): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  /** Opens the Usage access list, pre-selecting FocusUp where the OS supports it. */
  fun openSettings(context: Context) {
    val direct = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(direct)
    } catch (_: ActivityNotFoundException) {
      context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: SecurityException) {
      context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  /** Average foreground minutes per day for each tracked app over the last `days` days. */
  fun dailyAverages(context: Context, days: Int): Map<String, Any> {
    if (!granted(context)) return mapOf("granted" to false, "days" to 0, "minutes" to emptyMap<String, Double>())
    val window = days.coerceIn(1, 28)
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val start = end - window * DAY_MS
    val buckets = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end).orEmpty()
    // Some OEMs return overlapping daily buckets; keep one per package and day.
    val perBucket = HashMap<String, Long>()
    var earliest = end
    for (stat in buckets) {
      if (stat.firstTimeStamp < earliest) earliest = stat.firstTimeStamp
      val key = "${stat.packageName}@${stat.firstTimeStamp / DAY_MS}"
      perBucket[key] = maxOf(perBucket[key] ?: 0L, stat.totalTimeInForeground)
    }
    val totals = HashMap<String, Long>()
    for ((key, ms) in perBucket) {
      val pkg = key.substringBefore('@')
      totals[pkg] = (totals[pkg] ?: 0L) + ms
    }
    val covered = if (buckets.isEmpty()) 0 else ceil((end - maxOf(start, earliest)).toDouble() / DAY_MS).toInt().coerceIn(1, window)
    val minutes = tracked.associateWith { id ->
      val pkg = ProtectionPolicy.packages[id]
      val ms = if (pkg == null) 0L else totals[pkg] ?: 0L
      if (covered == 0) 0.0 else ms / 60000.0 / covered
    }
    return mapOf("granted" to true, "days" to covered, "minutes" to minutes)
  }
}
