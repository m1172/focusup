package expo.modules.focusupprotection

import android.content.Context
import org.json.JSONObject
import org.json.JSONArray
import java.util.Calendar

object ProtectionPolicy {
  val packages = mapOf("instagram" to "com.instagram.android", "youtube" to "com.google.android.youtube", "tiktok" to "com.zhiliaoapp.musically", "snapchat" to "com.snapchat.android", "x" to "com.twitter.android", "facebook" to "com.facebook.katana", "linkedin" to "com.linkedin.android", "reddit" to "com.reddit.frontpage")
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
  fun shouldBlock(context: Context, platform: String, now: Long = System.currentTimeMillis()): Boolean {
    val plan = plan(context)
    val strict = plan.optJSONObject("strict")
    if (strict != null && strict.optDouble("endsAt") > now && strings(strict.optJSONArray("platforms")).contains(platform)) return true
    val routines = plan.optJSONArray("routines") ?: JSONArray()
    for (index in 0 until routines.length()) {
      val routine = routines.optJSONObject(index) ?: continue
      if (routine.optBoolean("strict") && routineActive(routine, platform, now)) return true
    }
    val temporary = plan.optJSONObject("temporary")
    if (temporary != null && temporary.optString("platform") == platform && temporary.optDouble("endsAt") > now) return false
    if (strings(plan.optJSONArray("baseline")).contains(platform)) return true
    for (index in 0 until routines.length()) {
      val routine = routines.optJSONObject(index) ?: continue
      if (routineActive(routine, platform, now)) return true
    }
    return false
  }
}
