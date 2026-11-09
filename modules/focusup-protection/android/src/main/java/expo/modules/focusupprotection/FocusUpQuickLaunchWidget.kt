package expo.modules.focusupprotection

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Home Screen quick launch: opens Vaqtim's clean Instagram, YouTube or TikTok through a focusup:// link,
 * so every tap goes through the app's normal checks (sign-in, age, family rules, downtime, limits).
 * It shows no names, usage or other personal data. Added to the manifest by plugins/withQuickLaunchWidget.js.
 */
class FocusUpQuickLaunchWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.focusup_quick_launch)
      views.setOnClickPendingIntent(R.id.focusup_quick_instagram, open(context, "instagram", 1))
      views.setOnClickPendingIntent(R.id.focusup_quick_youtube, open(context, "youtube", 2))
      views.setOnClickPendingIntent(R.id.focusup_quick_tiktok, open(context, "tiktok", 3))
      manager.updateAppWidget(id, views)
    }
  }

  private fun open(context: Context, app: String, request: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("focusup://browser/$app")).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, request, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
