# FocusUp

FocusUp is an Uzbekistan-first digital wellbeing app. It keeps useful parts of social sites within an in-app browser and lets people hide distracting sections. The interface ships in Uzbek, Russian and English, with distinct light and dark themes.

See [release readiness](docs/release-readiness.md) for verified checks, deployment blockers and the remaining device matrix. To build store releases on this Mac without EAS, see [local release builds](docs/local-release-build.md).

## Run locally

Requirements: Node.js 22.13 or newer, npm, Xcode for the iOS simulator, and Android Studio for Android builds.

```sh
npm ci
npx expo start
```

Press `i` to open the iOS simulator or `a` to open Android. RevenueCat requires a native development build; Expo Go cannot run purchases. Build one locally with `npx expo run:ios` or `npx expo run:android`, or with EAS using `npx eas-cli build --profile development --platform all`.

Useful checks:

```sh
npm run typecheck
npm test
npx expo lint
npx expo-doctor
```

## Product behavior

The first run introduces the idea and lets users choose apps, then requires sign-in or verified registration before entering the app. Existing guests must also sign in; securely restored accounts can continue offline. Instagram and YouTube have settings and an in-app browser. TikTok, Snapchat, X, Facebook, LinkedIn and Reddit have separate capability entries; optimized browser integrations are not claimed available. Theme, language, app preferences, schedules and daily goal persist on the device with AsyncStorage. The current release sets `PRO_ENABLED = false`: premium features and purchase surfaces are hidden, RevenueCat is not initialized, and saved premium preferences remain stored but inactive. The retained Pro implementation reads RevenueCat's active `pro` entitlement rather than persisting a purchase flag.

Dashboard and statistics are based on local Clean Mode WebView sessions and explicit blocked Reels/Shorts navigation attempts. Session timing pauses when the app backgrounds. Raw events are retained for 30 days and daily aggregates for 400 days; no browsing URLs or social-site content is stored or sent to a backend. FocusUp does not estimate saved time and does not measure activity in other apps. When Pro is enabled in a future release, RevenueCat receives store transactions for purchase validation; FocusUp does not send social activity, browsing history, passwords, receipts, or payment details to its own analytics. Family mode is not included in the Pro promise.

## Structure

- `src/app/` contains Expo Router screens and tab navigation.
- `src/components/` contains the reusable interface controls and app rows.
- `src/features/apps/` contains the social platform catalog.
- `src/store/` contains the persisted Zustand preferences store.
- `src/theme/` contains spacing, radii and separate light/dark palettes.
- `src/translations/` contains Uzbek, Russian and English interface strings.
- `src/features/webview/` contains the reusable, session-preserving social WebView with loading and error states.
- `src/services/blockers/instagram/` contains the Instagram selector registry, semantic filter engine, SPA navigation listener and script generator. It observes targeted DOM changes locally and reports diagnostic events plus Reels navigation blocks; automatic DOM hiding is not counted as an interaction.
- `src/services/blockers/youtube/` contains YouTube's configurable Shorts, Home, related-video and comments filters, URL guard, selectors and SPA navigation listener. Search, subscriptions, playlists, channels and ordinary watch URLs remain allowed. Comments and sponsored-content filtering are off by default; sponsored filtering is unavailable until reliable markers are verified.
- `src/services/blockers/` also contains effective schedule/strict-mode settings.
- `src/services/schedules/` contains local time evaluation.
- `src/features/statistics/` renders period summaries, activity charts, platform totals, blocked attempts, streaks and empty states from local data.
- `src/services/analytics/` tracks privacy-safe session and blocked-navigation events, stores versioned daily aggregates, applies retention and calculates local-calendar statistics.
- `src/services/device-usage/` defines a future native device-usage provider; its Expo fallback always reports unavailable.
- `src/services/subscription/` contains RevenueCat setup, entitlement checks, offering access, and subscription feature access rules.
- `src/services/native-blocking/` connects the protection controller to the local Expo module, with an unavailable fallback for binaries without the module.
- `src/services/remote-config/` validates, caches and applies safe remote blocker kill switches. The app generates all filtering scripts from its bundled code.

## Social Browser Architecture

`src/features/webview/CleanSocialWebView.tsx` hosts Instagram and YouTube in a single reusable `react-native-webview` component. Platform URLs are centralized, the WebView has no changing React `key`, and saved filter changes inject an updated script into the existing page so its login session is not intentionally remounted. A compact native shell provides back, refresh, Clean Mode settings, themed loading/progress and localized retry/settings error states. The WebView allows HTTP(S) origins only; unrecognized external HTTP(S) links open through the system browser, while custom schemes are rejected.

The Dashboard and Apps tab open the supported platforms in the real in-app browser. Browser sessions emit local `SESSION_STARTED` and `SESSION_ENDED` events; the session tracker measures foreground time and pauses when the app backgrounds. Strict Mode and schedules feed the same effective blocker configuration.

## Instagram Clean Mode

Instagram opens at `https://www.instagram.com/`. Its selector registry, semantic detection, reversible marker styles, URL guard, SPA history hooks and generated script live under `src/services/blockers/instagram/`. Reels routes are guarded and return to the feed; navigation entries and identified Reels modules are hidden. Explore navigation is filtered while Search is preserved where the page exposes a distinct Search control. Suggested-post and recommendation removal depends on localized semantic headings, so these rules are best-effort. Normal posts, video posts, profiles, Stories, comments and messages are not targeted as a category. Sponsored-post filtering remains disabled because no stable, locale-safe marker is available.

## YouTube Clean Mode

YouTube opens at `https://m.youtube.com/`. The blocker hides Shorts navigation/cards/shelves and blocks direct `/shorts/` routes when enabled. Home recommendations and related videos have separate settings. Search, subscriptions, channels, playlists and ordinary watch URLs are allowed. Comment hiding is off by default and uses the mobile comments containers/entry point when present; page variants may not expose the same structure. Promotional-content filtering is disabled until reliable markers are verified. The Home screen can display a small native prompt to search or open subscriptions when its recommendation grid is hidden.

## Blocker Rule Architecture

Platform-specific selectors and detectors stay outside React Native UI components. The generated page scripts use root-scoped queries, semantic evidence, `WeakMap` processed-node tracking, a `MutationObserver`, frame-batched passes and coarse route listeners. Hiding uses reversible `data-focusup-hidden` markers instead of deleting website nodes. Each filter feature catches its own DOM errors so one broken rule does not prevent the site from loading. Filter failures are fail-open. Sponsored filtering is explicitly unavailable in settings.

Remote configuration supports known feature switches, constrained selector updates within trusted feature containers, allowlisted short-form routes, rule versions and kill switches. It never accepts executable code; all filtering logic comes from bundled FocusUp source. Rule diagnostics use `bundled-v1` unless a remote version is active. Never add `eval` or execute server-supplied JavaScript.

## Privacy Model

FocusUp does not inspect password fields, read or extract cookies/tokens, scrape DMs, contacts, post text or search queries, or proxy social traffic through its own servers. Login and website storage remain in the platform WebView session. The native bridge parses a strict typed message allowlist and rejects malformed events, wrong platforms, unknown features and extra fields. Page events contain a coarse route label (such as `watch` or `profile`), never a full URL, username, video ID or search query. Local analytics stores platform, blocker feature and timestamps/durations only; it does not upload social browsing data.

## WebView Limitations

Filtering is experimental and social sites can change their mobile DOM at any time. Instagram semantic suggestion detection and YouTube module selectors are best-effort. Google or other providers may restrict embedded-browser authentication. If a sign-in flow must be opened externally, that browser's session does not transfer back into FocusUp. The in-app browser does not filter native Instagram/YouTube apps or browsers opened elsewhere. iOS and Android use the same React Native WebView layer, but their cookie handling, media playback/fullscreen, navigation interception and authentication policies differ and require device QA before release.

The current source has unit coverage for generated scripts, navigation guards, route privacy and native-bridge validation. Live logged-out/logged-in provider flows, playback, fullscreen and actual filter reliability have not been verified on iOS or Android in this work session.

## Diagnostics

Development builds show platform, coarse current route, effective Clean Mode/filter configuration, observer/script status, last injection/filter timestamps and safe filter counts in platform settings. Diagnostics do not show cookies, credentials, account names, messages, page content, full URLs or search text. Production builds do not render this diagnostics card.

The app does not estimate saved time. Analytics stores local platform sessions and explicit blocked Reels/Shorts attempts; automatically hidden DOM elements are not counted as user interactions. Instagram and YouTube sign-in stays within the platform WebView. Google may reject sign-in inside embedded browsers; opening the system browser does not transfer its session back into FocusUp. The in-app filters do not affect social apps opened elsewhere.

## Statistics Architecture

`src/services/analytics/` is the single local measurement pipeline used by the Dashboard and Statistics screen. It stores typed session, blocked-navigation, Strict Mode and subscription event metadata. The browser tracker starts only after a successful initial WebView load, and records foreground segments while that browser is active. It pauses on app background, splits elapsed time across local calendar days, and uses stable session event IDs to make retries idempotent. When the app restarts, recovery closes the saved session using only already checkpointed time; it discards any uncertain time since the last checkpoint.

## Session Tracking

Only one FocusUp social browser session can be active at a time. Sessions shorter than 60 seconds still contribute measured duration but do not qualify as a meaningful session or streak day. The tracker persists state on lifecycle transitions and checkpoints active time once per minute, never every second. A failed first page load does not create a session. Background time and unknown crash gaps are excluded.

## Privacy

Detailed usage statistics are stored on the device. They contain platform, event kind, coarse blocked feature, timestamps and durations. Optional PostHog product analytics, masked session replay and error reporting are configured separately; see [observability setup](docs/observability.md). It does not contain full URLs, page text, video titles, search terms, account names, cookies, tokens or authentication data. Blocked-attempt counts come from explicit Reels/Shorts navigation callbacks; automatic DOM hiding is never counted as a user attempt. Similar callbacks for the same platform and feature within 800 ms are deduplicated.

## Aggregation

Daily aggregates use the device's local calendar and split foreground segments at local midnight. Day, week, month and year views are calculated from daily aggregates rather than loading a year of raw events. Streak days require at least 60 seconds of measured Clean Mode use on each local calendar day. Period comparisons are hidden until the prior period contains enough active days and at least 30 minutes of usage; percentage swings above 300% are also hidden to avoid overemphasizing a small baseline.

## Retention

Raw events are kept for 30 days in local date shards, so adding an event updates only that day's shard rather than rewriting the entire event history. Daily aggregates are retained for 400 days. The storage metadata is versioned; existing schema 1 monolithic events and daily keys migrate to schema 2 date-sharded events while preserving aggregates. Storage failures are swallowed by the analytics service so they cannot interrupt browsing.

## Streak Logic

A local day qualifies when its aggregate Clean Mode duration reaches `MIN_MEANINGFUL_SESSION_MS` (60 seconds). The current streak includes today if today qualifies; otherwise it checks from yesterday, allowing a streak to remain visible earlier in the day before the user has used Clean Mode. A missed local calendar day ends the current streak.

## Saved Time Policy

FocusUp currently measures actual time spent in its active social browser and explicit blocked navigation attempts. It does not infer how long a user would otherwise have spent on a feed, and it does not display an exact saved-time claim. The future-facing saved-time estimate API returns `null` until a defensible methodology exists.

Schedules apply inside FocusUp. Strict Mode is a Pro feature that stores its start and end timestamps locally, locks selected Instagram and YouTube settings, and turns on the Reels/Shorts baseline filters for the session. The app restores an active session after restart and expires it from the saved end timestamp. An emergency unlock requires a confirmation and a 30-second wait. Completed Strict Mode sessions are counted in local weekly statistics.

## Strict Mode Architecture

`src/services/strict-mode/` owns timestamp session creation, restoration, expiry, and controller orchestration. Zustand persists the active session and a snapshot of the selected app settings. The browser's effective configuration enforces Reels for Instagram and Shorts for YouTube while the session is active; preference mutations for selected apps remain locked. The UI presents a per-second local countdown and does not persist a decrementing timer. App startup after store hydration and foreground resume reconcile the saved session with the blocker.

The native blocker interface now connects to `modules/focusup-protection`, a local Expo module. Its iOS source implements FamilyControls selection, ManagedSettings shields, DeviceActivity monitoring and an optional ActivityKit widget. Its Android source implements package-only Accessibility detection and a FocusUp shield Activity. The module and four iOS extensions must be included in a new signed native build. Existing binaries and Expo Go report unsupported until the module is linked; native behavior has not been compiled or tested on a device in this continuation.

Local Strict Mode analytics events store event kind, duration, selected-platform count, and timestamp on the device. When PostHog is configured and enabled, coarse event summaries are also sent remotely. They do not include app usage outside FocusUp, browsing content, URLs, or account data.

## iOS Native Blocking

Source implementation uses Apple's system picker for apps/categories/web domains; opaque tokens remain in an App Group. The config plugin creates the monitor, shield configuration, shield action and Live Activity targets. Native timed intervals require at least 15 minutes. Shields close the protected app and guide the user to FocusUp; they do not attempt unsupported app launching from a ShieldAction extension. Apple Family Controls distribution approval, App Group registration, signing and physical-device verification remain required. See [native-protection.md](docs/native-protection.md).

## Android Native Blocking

Source implementation declares an opt-in AccessibilityService with `canRetrieveWindowContent=false`, no gestures and only window-state events. It reads foreground package names from a fixed eight-app allowlist and shows an original whole-app shield. It does not read screen nodes, messages, passwords or screenshots. The native service evaluates persisted routines and temporary-access expiry while JavaScript is suspended. It does not currently block native Reels/Shorts sections. Permission disclosure, Google Play declaration review, OEM battery behavior and device validation remain required.

## Required Permissions and Expo Development Build

FocusUp explains native protection before opening the Apple authorization flow or Android Accessibility settings. It does not request these permissions at launch. Usage Access is not used. iOS needs Family Controls and App Group entitlements on the appropriate targets; the plugin generates extension configuration. Regenerate the native projects through Expo config plugins, then create a new signed development build when ready. No prebuild, app build or launch was performed in this continuation. The native module resolves through Expo autolinking for both platforms, and the iOS extension plugin was verified against scratch copies of the Xcode project. These checks do not establish binary/device correctness.

## Current Limitations

- Native protection source is implemented but has not been compiled, signed or tested on iOS/Android devices.
- Native protection currently covers whole selected apps/categories on iOS and whole supported app packages on Android. Native section-specific Reels/Shorts detection is unavailable.
- Optimized Instagram/YouTube are Beta; live provider login, messages, accounts, uploads, playback and selector reliability still need device QA.
- Ten isolated cookie-store account slots, social message push notifications, forced background YouTube audio and reliable ads/Live/shopping filtering are unavailable.
- Family policy/provider models are prepared, but parent/child linking, authentication, managed child authorization and remote enforcement are unavailable and are not sold as Pro.
- Timers follow device timestamps and native OS scheduling. Manual clock changes, revoked permissions and OEM/system delays require validation.
- Local start reminders cover the upcoming seven days and refresh when FocusUp runs; a long period without opening the app can exhaust that reminder horizon.
- See the complete [capability ledger](docs/product-capabilities.md). No integration is labelled Stable without device QA.

## Remote Blocker Configuration

Set the optional `EXPO_PUBLIC_BLOCKER_CONFIG_URL` to a FocusUp-owned HTTPS endpoint returning JSON in this shape:

```json
{
  "schemaVersion": 1,
  "platforms": {
    "instagram": { "version": 4, "enabled": true, "features": { "reels": false } },
    "youtube": { "version": 8, "enabled": true, "features": { "shorts": true } }
  }
}
```

Only known platforms/features, booleans, bounded versions, constrained selector groups and short-form route patterns are accepted. A `false` value can disable a broken filter; remote rules cannot force-enable a user-disabled filter or execute code. Selector updates must remain within trusted platform containers and retain the bundled semantic checks. Broad roots, input/message selectors, script-like payloads and arbitrary routes are rejected. Responses are size-limited and time-limited. The last valid response is cached on-device for up to 30 days; network failure falls back to that cache or bundled defaults. An unset endpoint uses bundled behavior without making a request. Development diagnostics display the active rule version.

## Local Notifications

Mode reminders are optional and off by default. FocusUp explains them before asking the operating system. With permission, the app schedules Strict Mode completion, Temporary Access completion and enabled routine/Sleep start reminders. Native protection is independent of notification delivery. Up to 48 upcoming reminders are stored for the next seven days and refreshed on local-day/plan changes while the app runs. Disabling the reminder preference cancels FocusUp's mode reminders. Daily summaries and social message notifications are not claimed implemented.

## RevenueCat Setup

The subscription layer uses RevenueCat's public iOS/Android SDK keys and the single `pro` entitlement. The default Offering supplies localized prices at runtime; no production price or purchase success is hardcoded. Free users retain Reels/Shorts protection and today's basic statistics. See [docs/subscriptions-setup.md](docs/subscriptions-setup.md) for App Store Connect, Google Play Console, RevenueCat, legal URLs, and sandbox setup. Store product IDs shown in the setup guide are examples only; no external products or Offering are confirmed by this repository.

Real App Store and Google Play billing requires an Expo Development Build or production build. Expo Go is only suitable for UI preview when RevenueCat Preview API behavior is available. The current source does not claim store purchase validation; test each platform with its store sandbox or test track before release.

The app uses the RevenueCat native SDK. Configure the stores and RevenueCat dashboard before expecting real packages or purchases to appear:

1. Create a RevenueCat project.
2. Add the iOS app using its exact bundle identifier.
3. Add the Android app using its exact application ID.
4. Create monthly and annual auto-renewable subscription products in App Store Connect.
5. Create monthly and annual subscription products in Google Play Console.
6. Add the matching App Store and Play Store products to RevenueCat. Suggested product IDs are `focusup_pro_monthly` and `focusup_pro_annual` on each store; these are examples only and must match the products you create.
7. Create the `pro` entitlement and attach both products to it.
8. Create the `default` offering.
9. Add the monthly product as the monthly package and the annual product as the annual package in that offering.
10. Copy the RevenueCat **public SDK keys** into `.env` using the names in `.env.example`, or add those same `EXPO_PUBLIC_` variables to the EAS development and production environments.
11. Create and install a fresh Expo development build after installing the native RevenueCat packages. Use `npx eas-cli build --profile development --platform all` or local `npx expo run:ios` / `npx expo run:android`. Each native dependency change requires a new build.

The app automatically displays the localized prices returned by the store. Configure price points in App Store Connect and Google Play Console; the suggested business target is about $1.99/month and $14.99/year equivalent, but neither amount is embedded in the app. RevenueCat secret keys, App Store private keys, and Google service account keys must remain server-side and must never be added to the client.

The app reads only the active `pro` entitlement. The annual card is promoted when available, and savings are shown only when both plans have comparable numeric prices in the same currency. If keys, offerings, connectivity, or store products are unavailable, the free app remains usable and the paywall provides a retry state.

## Future work

- Complete native signing/entitlements, physical-device timer/revocation/reboot QA and store purchase sandbox testing.
- Validate logged-in/out provider behavior and selector drift before upgrading a platform from Beta to Stable.
- Implement persistent isolated account stores only when cookies, local storage, caches and service workers can all be isolated; never copy authentication cookies through JavaScript.
- Add additional optimized social integrations after independent implementation and provider QA.
- Build authenticated, consent-based parent/child linking and policy verification before enabling family enforcement.
- Configure real store products, SDK keys, legal pages and support contact information; finish device design/accessibility QA before store release.

## Focus, Sleep and Temporary Access

The original Focus tab brings native protection, routines, Sleep Mode and Strict Mode together. Sleep Mode expands local bedtime/wake rules with wind-down and morning buffers. Routines support overnight schedules, protected/allowed groups, per-platform filters, locking and opt-in reminders. Temporary Access uses one persisted timestamp window and restores configured native protections through native scheduling. Completed windows are measured separately from social-browser usage and never become a saved-time claim. iOS presets are 15/30 minutes; Android presets are 5/10.

Settings offers Home/Instagram/YouTube launch destinations. Help contains provider/login/privacy/subscription FAQs, a capability screen and a report composer using a configured support email. Privacy contains an explicit confirmed data reset limited to FocusUp storage and app WebView data; RevenueCat store identity and unrelated phone data remain intact.

See [product-capabilities.md](docs/product-capabilities.md) for current status and [native-protection.md](docs/native-protection.md) for platform design, permissions, extensions and validation limits.

## Optional backend and cloud accounts

The API runs on Supabase Edge Functions alongside Supabase PostgreSQL and Auth. Shared TypeScript API code and an optional local Fastify server live in `backend/`. See [Supabase deployment](docs/production-deployment.md); no Render account or purchased domain is required. It supports email/password, Apple, Google and Telegram OIDC authentication, profiles, revision-controlled settings backups, account export/deletion and a public blocker-config endpoint. Run `npm --prefix backend ci`, configure `backend/.env`, apply the SQL migration, then run `npm run backend:dev`. See [backend setup](docs/backend-setup.md) for provider configuration, API routes, deployment and the Supabase Free plan limits.

Settings → Your account provides email/password and configured provider sign-in, secure refresh-token storage, OAuth callbacks, profile editing, automatic settings backup and restore, sign-out and account deletion. Set `EXPO_PUBLIC_API_URL`, configure the provider credentials and email code templates, and rebuild the native app after installing dependencies. Full activity statistics stay local; cloud settings backup is explicit. When configured, PostHog sends product events and masked session recordings according to the Privacy tracking switch; see [observability setup](docs/observability.md). Run `npm run backend:check` to lint, typecheck and test the backend independently of Expo.
