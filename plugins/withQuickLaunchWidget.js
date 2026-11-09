const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

// Android Home Screen quick-launch widget. The provider and its layout live in modules/focusup-protection;
// this plugin adds its <receiver> only with { "enabled": true }. Keep WIDGETS_ENABLED in src/config/release.ts
// and "quickLaunchWidget" of withFocusUpProtection (iOS) in sync, with new runtime versions.
const RECEIVER = 'expo.modules.focusupprotection.FocusUpQuickLaunchWidget';

function withQuickLaunchWidget(config, { enabled = false } = {}) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;
    app.receiver = (app.receiver ?? []).filter((item) => item.$?.['android:name'] !== RECEIVER);
    if (enabled) app.receiver.push({
      $: { 'android:name': RECEIVER, 'android:exported': 'true', 'android:label': 'Vaqtim' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
      'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/focusup_quick_launch_info' } }],
    });
    return mod;
  });
}

module.exports = createRunOncePlugin(withQuickLaunchWidget, 'with-quick-launch-widget', '1.0.0');
