const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

// Google Play asks apps that let parents supervise a child's phone to declare
// <meta-data android:name="android.app.isMonitoringTool" android:value="child_monitoring" />
// in every release of the app (Play policy, "isMonitoringTool"). Vaqtim Family is that feature.
// Keep { "enabled": false } until the Family launch (docs/family.md): declaring it changes how Play
// reviews the app. Turn it on together with FAMILY_ENABLED in src/config/release.ts.
const NAME = 'android.app.isMonitoringTool';

function withMonitoringTool(config, { enabled = false } = {}) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;
    app['meta-data'] = (app['meta-data'] ?? []).filter((item) => item.$?.['android:name'] !== NAME);
    if (enabled) app['meta-data'].push({ $: { 'android:name': NAME, 'android:value': 'child_monitoring' } });
    return mod;
  });
}

module.exports = createRunOncePlugin(withMonitoringTool, 'with-monitoring-tool', '1.0.0');
