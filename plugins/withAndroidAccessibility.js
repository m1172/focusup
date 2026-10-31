const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

// The focusup-protection module declares an Accessibility service (real-app locking on Android).
// With { "enabled": false } the service is removed from the merged manifest, so Google Play
// does not ask for the Accessibility declaration. Keep `ANDROID_APP_BLOCKING` in
// src/config/release.ts in sync: it tells the app the feature is missing.
const SERVICE = 'expo.modules.focusupprotection.FocusUpAccessibilityService';

function withAndroidAccessibility(config, { enabled = true } = {}) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return mod;
    app.service = (app.service ?? []).filter((service) => service.$?.['android:name'] !== SERVICE);
    if (!enabled) {
      manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] ?? 'http://schemas.android.com/tools';
      app.service.push({ $: { 'android:name': SERVICE, 'tools:node': 'remove' } });
    }
    return mod;
  });
}

module.exports = createRunOncePlugin(withAndroidAccessibility, 'with-android-accessibility', '1.0.0');
