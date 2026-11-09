# AGENTS.md: rules and guide for AI assistants working on Vaqtim

This file is for any AI coding assistant (Claude, Codex, Cursor, Copilot, Gemini and others). Read it fully before you change anything. `CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` only point here, so this is the single source of truth.

If something here no longer matches the code, trust the code, fix this file in the same change, and say so.

---

## 1. What Vaqtim is

Vaqtim (repo and slug `focusup`) is a free iPhone and Android app that helps people stop endless scrolling.

- **Clean social apps inside Vaqtim.** Instagram, YouTube and TikTok open in Vaqtim's own browser (a WebView) with the short-video feeds hidden: Reels, Shorts and TikTok's For You. Messages, profiles, search and single shared videos keep working.
- **The real app gets blocked.** When you add an app on the Protect tab, Vaqtim blocks the real app on the phone: Screen Time (Family Controls) on iOS, an Accessibility service on Android. On iOS, opening the real app sends the user to Vaqtim instead. On Android, Instagram and YouTube stay usable and only their Reels and Shorts screens are closed (view IDs in `src/services/protection/androidFeeds.ts`); TikTok is blocked whole. Schedules, sleep, limits and Hard Mode block the whole app on both.
- **Free extras:** Explore, recommendation and Home filters, Instagram Stories and messages-only mode, YouTube Explore/Trending, grayscale (inside Vaqtim), schedules, sleep mode, daily limits and Post mode (the real app opens for 10 minutes to post, 3 times a day).
- **Pro extras (hidden while Pro is off):** Hard Mode (strict mode), breaks (temporary access), blocking extra apps, advanced statistics and YouTube comment hiding.
- **Languages:** Uzbek (default), Russian and English, everywhere: app, store listings and website.

| Item | Value |
|---|---|
| App name | Vaqtim |
| Bundle ID / package | `com.m1172.focusup` (iOS and Android) |
| Expo owner / project | `m1172` / `focusup` |
| URL scheme | `focusup://` |
| App Store ID | `6829294178` |
| Website | https://vaqtim.com (Cloudflare Pages) |
| Backend | Supabase Edge Function `focusup-api` (production), Fastify app in `backend/` |
| Analytics | PostHog (`src/services/analytics/`) |

---

## 2. Hard rules (never break these)

These come straight from the project owner. Following them matters more than finishing a task.

### Money, accounts and stores
1. **Vaqtim stays free.** Don't add a price, in-app purchases or subscriptions, and don't switch on `PRO_ENABLED`, unless the owner asks for it in the conversation.
2. **Never touch App Store Connect's Business section:** agreements, tax forms, DAC7, bank accounts. The developer account (team `GH6PP8FUU8`) also hosts other apps. If a submission is blocked by one of these, tell the owner what's missing and stop.
3. **Never type passwords, card numbers or 2FA codes.** If a store console, Apple ID or Google sign-in asks for one, the owner signs in themselves.
4. **Don't build or upload to the stores until the owner says the fixes are done.** That covers TestFlight archives and uploads, Play `.aab` uploads and `npm run release`. Finish the code, run the checks, then ask. Put several fixes into one build.
5. **Production changes need the owner's OK first:** an over-the-air update (`npm run update:publish`), a website deploy, a backend or Supabase deploy, or a database migration.

### Code and git
6. **Commit or push only when the owner asks.** Don't commit straight to `main`; work on a branch.
7. **Secrets never go into git or into a chat.** Keystores (`*.jks`), `credentials.json`, `credentials/`, `keys/` and `.env*` files are git-ignored and must stay that way. Don't print their contents. Only `.env.example` and `.env.production.example` are committed.
8. **`ios/` and `android/` are generated** by `npx expo prebuild` and git-ignored. Never edit them by hand. Native behaviour belongs in `app.json`, `plugins/*.js` or the local module `modules/focusup-protection/`.
9. **Add packages with `npx expo install <package>`**, never with `npm install <package>`, so versions match the Expo SDK.

### Product behaviour that must keep working
10. **Protect tab: an app counts as "added" only while its real app is blocked.** On iOS that means Screen Time access is given and the app is picked in Apple's list. On Android it means the Accessibility service is on. No path may add an app without the block: no "add anyway" button, and no silent adding when blocking isn't available. If access is taken away later, the app stops showing as added. The rule is `isRealAppBlocked()` in `src/features/protection/nativeAppSetup.ts`, used by `src/features/protection/useAppConnection.tsx`.
11. **Short-video feeds are always hidden inside Vaqtim.** Free users can't turn Reels, Shorts or For You back on.
12. **Only new users do onboarding.** Someone who signs in to an existing account (one that has a cloud settings backup) goes straight to Home. See `leaveAuth()` in `src/features/auth/navigation.ts`.
13. **Every piece of user-facing text exists in uz, ru and en.** `src/translations/__tests__/resources.test.ts` fails if a key is missing in any language. Don't hard-code text in components.
14. **No made-up claims.** No fake user counts, testimonials, expert quotes or statistics, in the app, the store listing or the website.
15. **Page scripts are untrusted.** Anything a WebView page sends (`ReactNativeWebView.postMessage`) must pass the strict checks in `src/services/social-browser/messages.ts` before the app acts on it.
16. **Only Instagram cookies are touched.** The account switcher reads and writes cookies for `instagram.com` only, through the native functions `getSiteCookies`, `setSiteCookies` and `clearSiteData`. Saved sign-ins live in SecureStore, split into pieces of 1800 characters or less.
17. **Vaqtim Family rules only add restrictions.** On a supervised child's phone nothing the child does (settings, a restored personal backup, clearing data, signing in, breaks) may weaken the parent's rules, and the phone sends no analytics. Family rules never go into the personal settings backup. See `docs/family.md`.
18. **Free means free everywhere.** A feature marked `'free'` in `FEATURE_ACCESS` must also work in the native plan (`buildNativePlan`), the browser (`getEffectiveAppConfig`), its screen's route guard (`src/app/_layout.tsx`) and its notifications. Never show Pro wording ("Pro settings", Pro badges) on a free control.
19. **New backed-up settings go in `extensions`.** The backup format the live server and older builds know is fixed; grayscale, daily limits and filters added since (`EXTENSION_FILTERS`) live in `payload.extensions` (`src/services/backend/settingsExtensions.ts`, `backend/src/settingsCompat.ts`). Builds send `X-Vaqtim-Settings: 2`; older builds never see extensions, and their saves keep them. If the server rejects extensions (not deployed yet), the app saves without them.
20. **The "Vaqtim features" page tells the truth.** `src/services/capabilities/features.ts` lists every feature as available, experimental or not available. Change it together with the feature, and keep `docs/product-capabilities.md` in step.

---

## 3. Release switches

Some features are switched on or off in code. Change a switch and its partner together, never just one of them.

| Switch | File | Now | Partner that must match |
|---|---|---|---|
| `PRO_ENABLED` | `src/config/release.ts` | `false` | `FEATURE_ACCESS` in `src/services/subscription/subscriptionService.ts`, RevenueCat keys, store products |
| `IOS_APP_BLOCKING` | `src/config/release.ts` | `true` | `familyControls` in the `withFocusUpProtection` plugin options in `app.json`; give `ios.runtimeVersion` a new value |
| `ANDROID_APP_BLOCKING` | `src/config/release.ts` | `true` | `enabled` in the `withAndroidAccessibility` plugin options in `app.json`; give `android.runtimeVersion` a new value; Google Play needs an Accessibility declaration and a video |
| `WEBSITE_BLOCKING` | `src/config/release.ts` | `false` | iOS applies the web filter to every web view, including Vaqtim's own, which showed "Website Not Allowed" |
| `FAMILY_ENABLED` | `src/config/release.ts` | `false` | Server secret `FAMILY_ENROLLMENT_ENABLED` (default `false`) and `FAMILY_COUNTRIES` (`UZ`); `enabled` in the `withMonitoringTool` plugin options in `app.json` (Play's `isMonitoringTool`); the launch checks in `docs/family.md` |
| `WIDGETS_ENABLED` | `src/config/release.ts` | `false` | `quickLaunchWidget` in the `withFocusUpProtection` options and `enabled` in the `withQuickLaunchWidget` options in `app.json`; new `ios.runtimeVersion` and `android.runtimeVersion` values |

iOS and Android follow the same Protect rule (rule 10): adding an app first asks for access to block the real app (Screen Time on iOS, the Accessibility service on Android). If either switch is turned off, that platform reports that it can't block apps, and its users can't add apps on the Protect tab.

---

## 4. Project map

```
src/app/                 Screens (Expo Router). Every file is a route; _layout.tsx files are navigators.
  (tabs)/                index = Home, focus = Protect, statistics, settings
  onboarding/            Onboarding steps (new users only)
  auth/                  Sign-in and the OAuth callback
  browser/[appId].tsx    The clean in-app browser for instagram / youtube / tiktok
src/features/            Screen pieces and logic per area (protection, webview, auth, onboarding, ...)
src/services/
  blockers/              Scripts injected into the pages that hide feeds (instagram/, youtube/, tiktok/)
  social-browser/        WebView routing, page messages, Instagram account switcher, app-promo hiding
  protection/            Builds the native blocking plan (engine.ts) and calls native code (nativeBridge.ts)
  remote-config/         Blocker rules fetched from vaqtim.com/blocker-config.json, so selectors can change without a new build
  backend/               Account session and API client
  analytics/             PostHog product analytics
src/store/               zustand stores (persisted with AsyncStorage; secrets use SecureStore)
src/translations/        All app text: uz, ru, en
src/config/release.ts    Release switches (section 3)
src/theme/, src/components/ui.tsx   Vaqtim's design tokens and shared components; use these for new UI
modules/focusup-protection/   Local Expo module: Swift (Screen Time, Shield, Monitor, cookies) and Kotlin (Accessibility, cookies)
plugins/                 Config plugins: Screen Time extensions and entitlements, Android Accessibility, release signing
backend/                 Fastify API (Node 22). Production runs as a Supabase Edge Function (supabase/functions/focusup-api)
supabase/                Migrations, Edge Functions, email templates
website/                 vaqtim.com: Next.js static export on Cloudflare Pages, with its own package.json (see website/README.md)
store/, store.config.json  Store listing text, screenshots and iOS export options
scripts/                 release.sh, bump-build.js, release-preflight.js
docs/                    Setup and launch guides (section 8)
```

---

## 5. Commands and checks

```bash
npm start                      # Metro dev server (dev client)
npm run ios                    # build and run on the iOS simulator
npm run android                # build and run on Android
npm run lint                   # expo lint
npm run typecheck              # tsc --noEmit
npm test                       # jest (whole suite)
npx expo-doctor                # dependency and config check
npm run backend:check          # backend lint, types and tests
cd website && npm run build    # website static build
```

**Before you say a task is done,** run `npm run lint`, `npm run typecheck` and `npm test`, and make sure all three pass. Then check the change in the running app (simulator or device) when it's something you can see. Report what you checked and what you couldn't.

---

## 6. Expo: don't trust your memory

This is Expo SDK 58 with React Native 0.88 and React 19. Expo changes APIs every SDK release. Before writing code that touches an Expo, EAS or React Native API:

1. Check the major version of `expo` in `package.json`.
2. Read the matching docs at `https://docs.expo.dev/versions/v58.0.0/`.
3. For anything else, start from https://docs.expo.dev/llms.txt and follow its links. Never answer from memory.

Routing uses **Expo Router**. Import `Link`, `router` and `useLocalSearchParams` from `expo-router`, and keep non-screen code out of `src/app/`.

Expo Go can't run this app because it has custom native code. Use a development build (`npm run ios` or `npm run android`).

---

## 7. Releasing

Store builds are made **locally** (Xcode and Gradle), not with EAS Build. The full guide is `docs/local-release-build.md`. Remember rule 4: only build when the owner says so.

- `npm run release` bumps the build number, runs `release:check`, regenerates the native folders, builds, and uploads to TestFlight and Play internal testing. Pass `--ios` or `--android` for one platform, or `--no-bump` to rebuild the same number.
- Build numbers: `ios.buildNumber` and `android.versionCode` in `app.json`. Every upload needs a higher number.
- **Over-the-air updates** (`npm run update:publish "<message>"`, channel `production`) only reach builds with the same runtime version. iOS uses `ios.runtimeVersion` (now `1.0.0-screentime`) and Android uses `android.runtimeVersion` (now `1.0.0-accessibility`), so builds made before Screen Time or the Accessibility service was switched on never get updates meant for later builds. JavaScript-only fixes can ship this way. Native changes need a new store build.
- Known local build problems:
  - `pod install` needs `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
  - Gradle can run out of memory. Use `-Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g"`.
- After uploading an iOS build, it still has to be added to the TestFlight groups in App Store Connect.
- **Server and app must agree on the settings format.** The live API is the Supabase Edge Function `focusup-api`, built from `backend/src/`. When you change `backend/src/schemas.ts` (or add a setting the app backs up), the server must be redeployed (`npx --yes supabase@2.121.0 functions deploy focusup-api --use-api --project-ref vrmfrhvzvjrktiosptdp`, after `npm run backend:check`), with the owner's OK (rule 5). Otherwise the server rejects every backup with `VALIDATION_ERROR`; this happened from 31 October to 3 November 2026. Since November 2026 the app falls back to saving without `extensions` when that happens (rule 19), but the old fields must never gain new keys.

### Testing limits
- The iOS simulator has **no Screen Time**. It reports blocking as unavailable, so the Protect tab can't add apps there. Test Screen Time, Apple's app list and shields on a real iPhone.
- On Android, the Accessibility service can be tested on an emulator or phone. On Android 13 and later, an app installed outside Google Play needs "Allow restricted settings" (App info, ⋮ menu) before its service can be turned on.
- Signing in to Vaqtim, Instagram and so on needs the owner to type their passwords (rule 3).
- Jest: variables used inside a `jest.mock()` factory must start with `mock` (for example `mockGetSettings`).

---

## 8. More documentation

| Topic | File |
|---|---|
| Launch checklist (stores, website, domain) | `docs/launch/README.md` |
| App Store, including Family Controls and review notes | `docs/launch/app-store.md` |
| Google Play | `docs/launch/google-play.md`, `docs/launch/google-play-step-by-step.md` |
| Local release builds | `docs/local-release-build.md` |
| Native blocking (Screen Time / Accessibility) | `docs/native-protection.md` |
| What works today, per feature | `docs/product-capabilities.md` |
| Backend and Supabase | `docs/backend-setup.md`, `docs/production-deployment.md` |
| Subscriptions (for later; Pro is off) | `docs/subscriptions-setup.md` |
| Logs and crash reports | `docs/observability.md` |
| Device test checklist | `docs/device-qa-matrix.md` |
| Telegram sign-in | `docs/launch/telegram-login.md` |
| Website | `website/README.md` |
| Vaqtim Family (parent and child phones) | `docs/family.md` |

---

## 9. How to work here

- Start from existing code. Most features already exist, so extend them instead of rebuilding.
- New UI uses Vaqtim's theme (`src/theme`) and components (`src/components/ui.tsx`), works in light and dark mode, and fits small phones.
- Add or update tests with every behaviour change: a pure function plus a unit test is the usual pattern.
- Keep code comments short and plain.
- When a user's report doesn't match what the code should do, find the cause before changing anything, and explain it in plain words.
- When you learn a new lasting rule from the owner, add it to section 2 of this file.
