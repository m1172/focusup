/** Source-controlled release switch. Preserve Pro code and saved settings for a future release. */
export const PRO_ENABLED: boolean = false;

/**
 * Android real-app locking uses an Accessibility service, which Google Play only accepts with an extra declaration
 * and video. While this is false the app treats Android as unsupported (in-app filters only), and
 * `plugins/withAndroidAccessibility.js` must be set to `{ "enabled": false }` in app.json so the service
 * is left out of the build too. Turn both on together.
 */
export const ANDROID_APP_BLOCKING: boolean = false;
