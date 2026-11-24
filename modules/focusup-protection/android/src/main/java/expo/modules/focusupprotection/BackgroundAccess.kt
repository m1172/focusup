package expo.modules.focusupprotection

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

/**
 * Some phones (Xiaomi, Samsung, Huawei, Oppo, Vivo, OnePlus and others) stop background apps to save battery,
 * which also stops Vaqtim's blocking. These helpers report that and open the right Settings screen.
 * No special permission is used: the person changes the setting themselves.
 */
object BackgroundAccess {
  fun maker(): String = Build.MANUFACTURER.orEmpty().lowercase()

  fun batteryRestricted(context: Context): Boolean {
    val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
    return !power.isIgnoringBatteryOptimizations(context.packageName)
  }

  /** The battery list where "Don't optimize" / "No restrictions" is chosen; the app's own page if that list is missing. */
  fun openBatterySettings(context: Context): Boolean =
    start(context, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) ||
      start(context, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))

  /** Phone makers' own auto-start screens. False when this phone has none we know. */
  fun openAutoStartSettings(context: Context): Boolean = autoStartScreens.any { (pkg, cls) ->
    // Explicit intents: another app's screen can be opened without seeing its package (Android 11 visibility).
    try { context.startActivity(Intent().setComponent(ComponentName(pkg, cls)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true } catch (_: Exception) { false }
  }

  /** Makers known to stop background apps and to have an auto-start or app-launch screen. */
  fun hasAutoStartSettings(): Boolean = listOf("xiaomi", "redmi", "poco", "huawei", "honor", "oppo", "realme", "oneplus", "vivo", "iqoo", "samsung", "asus").any { maker().contains(it) }

  private val autoStartScreens = listOf(
    "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
    "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
    "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
    "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
    "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
    "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
    "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity",
    "com.oneplus.security" to "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity",
    "com.samsung.android.lool" to "com.samsung.android.sm.ui.battery.BatteryActivity",
    "com.asus.mobilemanager" to "com.asus.mobilemanager.powersaver.PowerSaverSettings",
  )

  private fun start(context: Context, intent: Intent): Boolean = try {
    if (intent.resolveActivity(context.packageManager) == null) false
    else { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true }
  } catch (_: Exception) { false }
}
