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
