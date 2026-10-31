package expo.modules.focusupprotection

import android.content.Context
import org.json.JSONObject
import org.json.JSONArray
import java.util.Calendar

object ProtectionPolicy {
  val packages = mapOf("instagram" to "com.instagram.android", "youtube" to "com.google.android.youtube", "tiktok" to "com.zhiliaoapp.musically", "snapchat" to "com.snapchat.android", "x" to "com.twitter.android", "facebook" to "com.facebook.katana", "linkedin" to "com.linkedin.android", "reddit" to "com.reddit.frontpage")
  /** Regional builds of the same app, mapped to their platform (TikTok ships as "trill" in parts of Asia). */
  val packageAliases = mapOf("com.ss.android.ugc.trill" to "tiktok")
  fun platformFor(packageName: String?): String? = packageName?.let { name -> packages.entries.firstOrNull { it.value == name }?.key ?: packageAliases[name] }
  fun preferences(context: Context) = context.getSharedPreferences("focusup_protection", Context.MODE_PRIVATE)
  fun plan(context: Context): JSONObject = try { JSONObject(preferences(context).getString("plan", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
  private fun strings(array: JSONArray?): Set<String> = if (array == null) emptySet() else (0 until array.length()).map { array.optString(it) }.toSet()
  private fun minute(value: String): Int { val parts = value.split(":").mapNotNull { it.toIntOrNull() }; return if (parts.size == 2) parts[0] * 60 + parts[1] else -1 }
  private fun routineActive(routine: JSONObject, platform: String, now: Long): Boolean {
    if (!routine.optBoolean("enabled") || !strings(routine.optJSONArray("apps")).contains(platform) || strings(routine.optJSONArray("allowedApps")).contains(platform)) return false
    val start = minute(routine.optString("start"))
    val end = minute(routine.optString("end"))
    if (start < 0 || end < 0 || start == end) return false
    val days = routine.optJSONArray("weekdays") ?: return false
    val daySet = (0 until days.length()).map { days.optInt(it) }.toSet()
    val calendar = Calendar.getInstance().apply { timeInMillis = now }
    val day = calendar.get(Calendar.DAY_OF_WEEK) - 1
    val currentMinute = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
    return if (start < end) daySet.contains(day) && currentMinute >= start && currentMinute < end else (daySet.contains(day) && currentMinute >= start) || (daySet.contains((day + 6) % 7) && currentMinute < end)
  }
  private fun day(now: Long): String { val c = Calendar.getInstance().apply { timeInMillis = now }; return "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH)) }
  /** Foreground seconds in an original app today; counted only for apps that have a daily limit. */
  fun usedSeconds(context: Context, platform: String, now: Long = System.currentTimeMillis()): Long = preferences(context).getLong("usage.${day(now)}.$platform", 0L)
  fun addUsage(context: Context, platform: String, seconds: Long, now: Long = System.currentTimeMillis()) {
    if (plan(context).optJSONObject("dailyLimits")?.has(platform) != true) return
    val prefs = preferences(context); val key = "usage.${day(now)}.$platform"
    val editor = prefs.edit().putLong(key, prefs.getLong(key, 0L) + seconds)
    // Keep only today's counters.
    prefs.all.keys.filter { it.startsWith("usage.") && !it.startsWith("usage.${day(now)}.") }.forEach { editor.remove(it) }
    editor.apply()
  }
  fun limitReached(context: Context, platform: String, now: Long = System.currentTimeMillis()): Boolean {
    val minutes = plan(context).optJSONObject("dailyLimits")?.optInt(platform, 0) ?: 0
    return minutes > 0 && usedSeconds(context, platform, now) >= minutes * 60L
  }
  fun shouldBlock(context: Context, platform: String, now: Long = System.currentTimeMillis()): Boolean {
    val plan = plan(context)
    val routines = plan.optJSONArray("routines") ?: JSONArray()
    for (index in 0 until routines.length()) {
      val routine = routines.optJSONObject(index) ?: continue
      if (routine.optBoolean("strict") && routineActive(routine, platform, now)) return true
    }
    // A break lifts Hard Mode for its one app; strict routines above still win.
    val temporary = plan.optJSONObject("temporary")
    if (temporary != null && temporary.optString("platform") == platform && temporary.optDouble("endsAt") > now) return false
    val strict = plan.optJSONObject("strict")
    if (strict != null && strict.optDouble("endsAt") > now && strings(strict.optJSONArray("platforms")).contains(platform)) return true
    if (strings(plan.optJSONArray("baseline")).contains(platform)) return true
    if (limitReached(context, platform, now)) return true
    for (index in 0 until routines.length()) {
      val routine = routines.optJSONObject(index) ?: continue
      if (routineActive(routine, platform, now)) return true
    }
    return false
  }
}
