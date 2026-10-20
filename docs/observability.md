# PostHog analytics, replay and errors

FocusUp integrates `posthog-react-native` and `@posthog/react-native-plugin` for Android and iOS. A single PostHog project receives both platforms; filter by the `platform` property (`android` / `ios`) or the SDK's OS/device properties. This is a source integration, not a claim that live delivery or device recording has been verified.

## Activate

1. Create or choose a PostHog project. Add its **public project key** and ingestion host to `.env` for local development, and to the appropriate EAS environment for cloud builds:

   ```dotenv
   EXPO_PUBLIC_POSTHOG_KEY=phc_your_project_key
   EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
   ```

   For a US project use `https://us.i.posthog.com`. Leave the key blank to disable remote tracking completely. No project key has been added to this repository. EAS build profiles label events as `development`, `preview` or `production`; local builds default to `development`.

2. In PostHog project settings, enable **Record user sessions** and **Enable exception autocapture**. Keep the replay project setting enabled for the environments you want to record. The app requests a replay sample rate of `1` (100%) and a snapshot throttle of `1000` ms. Server settings, offline delivery and OS support can still affect which recordings arrive.

3. Create **fresh native builds** after adding these packages. An existing development client, Expo Go or an OTA update cannot add the native plugin:

   ```sh
   npx eas-cli@latest build --profile development --platform all
   # Or production store builds:
   npx eas-cli@latest build --profile production --platform all
   ```

   The current development iOS profile targets the simulator. Use a device-capable profile for physical iPhone QA. For local CNG builds, regenerate through Expo (`npx expo prebuild`) and rebuild; do not edit generated iOS/Android projects by hand. Replay requires Android API 26+ and iOS 13+ (the app's Expo SDK may impose higher minimums).

4. In PostHog, use **Activity** for events, **Product analytics** for funnels/retention, **Session replay** for recordings, and **Error tracking** for exceptions. Filter the environment and platform before comparing reports.

## What is sent

`src/services/analytics/productAnalytics.ts` owns remote configuration, identity, screen tracking, event mapping, consent and JS diagnostic redaction. Existing local statistics storage and calculations remain independent.

| Events | Trigger / properties |
| --- | --- |
| `$screen` | Initial screen and screen changes; stable names derived from route templates. Consecutive duplicates are suppressed. Route query strings, auth callback codes, URLs and arbitrary dynamic parameters are excluded. |
| SDK lifecycle events | Application install/update/open/foreground/background, as supported by the SDK. |
| `onboarding_started` | Welcome screen opens; source `welcome`. |
| `onboarding_completed` | The hydrated preference store transitions to completed, after the app's onboarding/auth flow. |
| `auth_started`, `auth_succeeded`, `auth_failed` | Email, native Apple and configured provider sign-in. Failures include a normalized code, never credentials. OAuth completion uses provider `oauth`; the attempted provider is on `auth_started`. Requesting a sign-up email without a session does not count as success. |
| `clean_session_started`, `clean_session_paused`, `clean_session_ended` | Existing social-browser session callbacks. Social platform, coarse duration range and meaningful-session flag; no local timestamps, session identifiers or foreground segments. |
| `distraction_blocked` | Existing explicit blocked-attempt events; platform, feature and source. Existing blocked-navigation deduplication still applies; passive DOM hiding is not counted as an attempted navigation. |
| `app_protection_changed`, `filter_changed` | Changes after preference hydration; social platform, feature and enabled state. |
| `browser_failed` | A WebView load error; social platform and a fixed failure code. No failing URL or page text. |
| `notification_permission_requested`, `notification_permission_result` | Actual OS permission request and result; granted/status and whether a request was made. |
| `notification_opened` | Recognized Strict Mode/wellbeing notification responses accepted by the existing notification listener; kind and source. No notification text or payload upload. |
| `strict_mode_started`, `strict_mode_completed`, `strict_mode_ended_early` | Existing Strict Mode events; duration range and protected-platform count. |
| `temporary_access_started`, `temporary_access_completed` | Existing temporary-access events; social platform and duration range. |
| `paywall_viewed`, `subscription_plan_selected`, `purchase_started`, `purchase_completed`, `purchase_cancelled`, `purchase_failed`, `restore_started`, `purchase_restored` | Existing subscription events; plan and entry source. `purchase_restored` maps the existing `restore_completed` callback, not proof of a new purchase. |

Pro-related events fire only when the corresponding feature is enabled and used. The current free-launch feature gate does not get changed by this integration.

Duration ranges are `under_1m`, `1_5m`, `5_15m`, `15_30m`, `30_60m`, `60m_plus`. Custom product events do not send precise usage durations or full activity history. Every JS event receives current/previous screen context once available, environment, platform and preferred language; the SDK supplies app version/build and device context. GeoIP is enabled for approximate country/city, without requesting GPS permission.

Restored/signed-in users are identified by backend user ID and language. A stale SDK user, account switch, sign-out or successful account-deletion cleanup resets identity so subsequent use cannot remain attached to the previous account. Anonymous onboarding events can be associated with the account at sign-in.

## Replay visibility and privacy

Visible app text and images are recorded on **both native platforms**. Replay uses native screenshots/view capture and does not need touch/button product-event autocapture. The following are explicitly wrapped in `PostHogMaskView`:

- Authentication fields, including passwords even when the visibility toggle reveals them, email addresses and one-time codes.
- The account screen, including profile fields and account details.
- Embedded social WebViews and the browser's URL input. Social posts, searches, messages, profiles and third-party login content are masked; native FocusUp controls around the browser remain visible.

System sandboxed views are also masked. Other FocusUp screens, including usage charts and goals, remain visible in replay. Replay pixel data and native crash payloads do **not** pass through the JS event sanitizer. Do not assume filtering an event property also hides it from a recording.

Replay console/Logcat capture and native network telemetry are disabled. Arbitrary logs and network URLs are not uploaded; native network telemetry would otherwise be iOS-only. Automatic touch/button product-event capture, automatic push-token registration and push-open payload capture are disabled. Remote feature-flag evaluation is disabled; the SDK still loads the remote configuration needed for replay/error settings.

Privacy → **Usage analytics & session replay** has a persisted switch in English, Russian and Uzbek. For the requested reference behavior, tracking defaults to enabled when configured; there is no pre-recording consent prompt. Turning the switch off gates events immediately, opts the native SDK out, stops replay and resets identity while preserving opt-out. A saved denial prevents SDK construction on a subsequent launch. Storage failure during initialization fails closed. Local statistics still work. Configure your published privacy disclosures and any required consent flow for this behavior before distribution.

Clear local FocusUp data disables remote capture before clearing state and preserves the denial across the reset. Neither a local reset nor resetting the SDK identity deletes records already ingested by PostHog; manage retention/deletion in PostHog separately.

## Error reports and readable stacks

Runtime capture includes uncaught JS exceptions, unhandled promise rejections, React errors reaching the exported Expo Router root error boundary, handled account-session restoration errors, native iOS crashes and native Android Java/Kotlin crashes. Android C/C++ crash capture is enabled where the plugin supports it (Android 12+). Native reports may arrive on the next launch. Console errors are not automatically converted to exceptions.

The JS `before_send` hook removes common sensitive properties recursively and redacts emails, web/deep-link URLs, bearer tokens, JWTs and credential-like diagnostic assignments. Explicit `captureAppException` reports are deduplicated for ten seconds. This is not a guarantee that arbitrary free-text/native crash data can be sanitized; avoid including secrets in thrown errors.

The installed `@posthog/cli` and `metro.config.js` support source-map debug IDs. To enable build-time JS source-map and native-symbol uploads, configure these **build-time-only** EAS variables:

```dotenv
POSTHOG_CLI_API_KEY=your_personal_api_key
POSTHOG_CLI_PROJECT_ID=your_project_id
POSTHOG_CLI_HOST=https://eu.posthog.com
```

Use `https://us.posthog.com` for US Cloud. Keep the personal API key secret; never use an `EXPO_PUBLIC_` prefix. `app.config.ts` adds the official `posthog-react-native/expo` plugin with `uploadNativeSymbols: true` only when the CLI key and project ID exist. This configures iOS dSYM and Android mapping/native-symbol upload hooks through prebuild. Builds without those credentials still work, but crash stacks may be unsymbolicated. EAS Update source maps need a separate upload after the update (`posthog-cli hermes upload --directory dist`); native build upload hooks do not run for OTA updates.

## Device acceptance checklist

Local verification: lint, TypeScript, the Jest suite and JavaScript/Hermes exports for both platforms are checked during implementation. Expo Doctor reports pre-existing Expo/Router/dev-client patch and Jest major-version mismatches; the added PostHog/Expo support packages introduce no additional Doctor dependency warnings. No native binary or live PostHog delivery has been verified in this integration.

Run on fresh iOS and Android native builds with a test PostHog project:

1. Finish onboarding and sign in. Check screen, auth and onboarding events, backend user ID, language, environment and platform.
2. Change filters, open a social browser, trigger a blocked navigation, background/resume and close it. Check ordered events and duration ranges; verify no social URLs/content or credentials appear in event properties.
3. Watch each platform's recording. Verify normal app text/images are visible, auth/account fields and the social WebView/link sheet are masked, and recording continues across screens. Verify password reveal stays masked and uploads never expose third-party browsing content.
4. Opt out, navigate, trigger a handled error, then relaunch. Verify no new capture or replay. Opt in again and check capture resumes. Confirm local statistics continue while opted out.
5. Sign out and switch accounts; check events/replays do not remain associated with the prior account. Clear local data and verify opt-out remains after relaunch.
6. In a non-production test build, trigger handled, unhandled and render errors, then a native test crash using platform tooling. Check both platform filters, the next launch, release association and stack symbolication when upload credentials are configured. No deliberate crash button ships in the app.

Sources: [PostHog React Native SDK](https://posthog.com/docs/libraries/react-native), [native replay setup](https://posthog.com/docs/session-replay/installation/react-native), [React Native errors](https://posthog.com/docs/error-tracking/installation/react-native), [source maps/native symbols](https://posthog.com/docs/error-tracking/upload-source-maps/react-native), [Expo Router screen tracking](https://docs.expo.dev/router/reference/screen-tracking/).
