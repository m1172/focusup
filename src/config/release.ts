/** Source-controlled release switch. Preserve Pro code and saved settings for a future release. */
export const PRO_ENABLED: boolean = false;

/**
 * Android real-app locking uses an Accessibility service, which Google Play only accepts with an extra declaration
 * and video. While this is false the app treats Android as unsupported (in-app filters only), and
 * `plugins/withAndroidAccessibility.js` must be set to `{ "enabled": false }` in app.json so the service
 * is left out of the build too. Turn both on together.
 */
export const ANDROID_APP_BLOCKING: boolean = false;

/**
 * iOS real-app locking uses Screen Time (Family Controls), which needs Apple's distribution approval before
 * TestFlight/App Store builds can be signed. While this is false the app treats iOS as unsupported (in-app filters
 * only), and `plugins/withFocusUpProtection.js` must be set to `{ "familyControls": false }` in app.json so the
 * entitlement and Screen Time extensions are left out of the build. Turn both on together.
 */
export const IOS_APP_BLOCKING: boolean = false;

/**
 * "Block the website" uses Screen Time's web filter, which iOS applies to every web view on the phone, including
 * Vaqtim's own browser. Blocking instagram.com there also showed "Website Not Allowed" inside Vaqtim. While this is
 * false the switch is hidden and the app sends iOS an empty website list (which also clears an old block).
 */
export const WEBSITE_BLOCKING: boolean = false;
