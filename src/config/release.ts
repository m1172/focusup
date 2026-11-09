/** Source-controlled release switch. Preserve Pro code and saved settings for a future release. */
export const PRO_ENABLED: boolean = false;

/**
 * Android real-app locking uses an Accessibility service that only reads which app is in front (no screen content).
 * Adding an app on the Protect tab needs it, the same as Screen Time on iOS. Google Play asks for an Accessibility
 * declaration and a short video for builds that include it (docs/launch/google-play.md). Turning this off also
 * needs `plugins/withAndroidAccessibility.js` set to `{ "enabled": false }` in app.json, and a new
 * `android.runtimeVersion`, so over-the-air updates never reach a build without the service. Change all three together.
 */
export const ANDROID_APP_BLOCKING: boolean = true;

/**
 * iOS real-app locking uses Screen Time (Family Controls). Apple approved the distribution entitlement in
 * November 2026, so store builds include it. Turning this off also needs `plugins/withFocusUpProtection.js` set to
 * `{ "familyControls": false }` in app.json, so the entitlement and Screen Time extensions are left out. Change
 * both together, and give iOS a new `ios.runtimeVersion` so over-the-air updates never reach a build without them.
 */
export const IOS_APP_BLOCKING: boolean = true;

/**
 * "Block the website" uses Screen Time's web filter, which iOS applies to every web view on the phone, including
 * Vaqtim's own browser. Blocking instagram.com there also showed "Website Not Allowed" inside Vaqtim. While this is
 * false the switch is hidden and the app sends iOS an empty website list (which also clears an old block).
 */
export const WEBSITE_BLOCKING: boolean = false;

/**
 * Vaqtim Family (parent and child phones). While false the Settings row and the "Connect to my parent" button are
 * hidden, so nobody can start using it. A phone that is already supervised keeps syncing either way, so its rules,
 * removal and release still work. The server has its own switch, `FAMILY_ENROLLMENT_ENABLED` (backend/src/config.ts),
 * and both must be on before families can enroll. Keep both off until the Uzbekistan launch checks in
 * docs/family.md are done.
 */
export const FAMILY_ENABLED: boolean = false;

/**
 * Home Screen quick-launch widgets (iOS WidgetKit, Android App Widgets), added by `plugins/withQuickLaunchWidget.js`.
 * They need a new store build, so this stays false until a build with the widget is on the stores and tested on
 * real phones; while false the features page lists widgets as not available. Turning the plugin off in app.json
 * and this switch go together, with new `ios.runtimeVersion` and `android.runtimeVersion` values.
 */
export const WIDGETS_ENABLED: boolean = false;
