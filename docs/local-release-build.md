# Build and publish store releases locally (no EAS Build)

Release builds are made on this Mac with Xcode and Gradle. `ios/` and `android/` stay generated
(Continuous Native Generation): change native behavior in `app.json` and `plugins/`, never by hand.

## Every release: one command

```sh
npm run release                 # bump build number, check, regenerate, build + upload iOS and Android
npm run release -- 1.0.1        # same, with a new user-visible version
npm run release -- --ios        # only iOS (or --android)
npm run release -- --no-bump    # retry the same build number after a failed upload
```

`scripts/release.sh` runs these steps and stops at the first failure:

1. `release:bump`: raises `ios.buildNumber` and `android.versionCode` in `app.json` (the stores
   reject a number they have already seen).
2. `release:check`: `scripts/release-preflight.js`, then lint, typecheck, tests and expo-doctor. The
   pre-flight stops the build when `.env.production` is missing or not production, the legal URLs
   are empty, `TEMP_FORCE_PRO` is on, or Pro is on without RevenueCat keys. It warns when the
   Android upload key is missing.
3. `native:sync` (`expo prebuild`): regenerates `ios/` and `android/` from `app.json`.
4. `build:ios` + `upload:ios`: archives with Xcode and uploads to App Store Connect (TestFlight).
5. `build:android` + `upload:android`: builds the signed `.aab` and uploads it to Google Play's
   **internal testing** track as a **draft** (EAS Submit uploads the local file; nothing is built in the cloud).

After it finishes: test the build in TestFlight and Play internal testing, then submit for review
in App Store Connect and Play Console. That last click stays manual on purpose.

Store listing text for the App Store lives in `store.config.json`; push it with
`npm run store:metadata` (EAS Metadata, App Store only). Google Play listing text is in
[launch/google-play.md](launch/google-play.md) and is pasted into Play Console by hand.

If `pod install` fails with `Encoding::CompatibilityError`, add `export LANG=en_US.UTF-8` to `~/.zshrc`.

## One-time setup

| What | Why | How |
| --- | --- | --- |
| Xcode signed in to team `GH6PP8FUU8` | iOS signing and upload | Xcode › Settings › Accounts |
| Family Controls (Distribution) approved | Only when `familyControls` is on: the archive/upload fails without it | [launch/app-store.md §1](launch/app-store.md) (requested 31 Oct 2026; v1.0 ships without it) |
| Android upload key | Play rejects debug-signed builds | [Android › One-time setup](#one-time-setup-1) below |
| Google Play service account | Lets `upload:android` upload builds | Below |
| Expo account login | EAS Submit and EAS Metadata run under it | `npx eas-cli@latest login` once (project `m1172/focusup`) |
| First Android build uploaded by hand | Google's API cannot create an app's first release | Play Console › Testing › Internal testing › Create release |

### Google Play service account (for `upload:android`)

1. Google Cloud Console: create a service account in any project, then **Keys › Add key › JSON** and download it.
2. Play Console › **Users and permissions › Invite new users**: invite the service account's email with
   **Release apps to testing tracks** (and **Release to production** if you want that later) for Vaqtim.
3. Save the JSON as `keys/google-play-service-account.json` in this repository folder. `/keys/` is
   git-ignored; never commit it. `eas.json` (`submit.production.android.serviceAccountKeyPath`) points there.

### Production settings: `.env.production`

Release builds bundle JavaScript in production mode, which loads `.env.production` over `.env`.
It is git-ignored; copy `.env.production.example` on a new machine. Only public values belong here
(everything in it ships inside the app).

| Key | Value now |
| --- | --- |
| `EXPO_PUBLIC_APP_ENV` | `production` |
| `EXPO_PUBLIC_API_URL` | the Supabase `focusup-api` function |
| `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_POLICY_URL` | `https://vaqtim.pages.dev/terms/` and `/privacy/` (switch to vaqtim.com once the domain is connected) |
| `EXPO_PUBLIC_REVENUECAT_*` | only needed when `PRO_ENABLED` is true |

## iOS (App Store / TestFlight)

Team `GH6PP8FUU8` is set in `app.json` (`ios.appleTeamId`); Xcode manages certificates and profiles.
Sign in to that Apple account once in **Xcode › Settings › Accounts**.

```sh
npm run build:ios     # archives to build/Vaqtim.xcarchive
npm run upload:ios    # signs for the App Store and uploads to App Store Connect
```

`upload:ios` uses `store/ios-export-options.plist`. You can also upload by hand from
**Xcode › Window › Organizer › Archives › Distribute App › App Store Connect**.
The build appears in App Store Connect › TestFlight after Apple finishes processing (10–30 minutes).

The app ships four extensions (Family Controls monitor/shield/shield action and a Live Activity).
Each needs a distribution profile, and Family Controls needs Apple's **distribution** entitlement
approval, not only the development entitlement ([launch/app-store.md §1](launch/app-store.md)). Until Apple
approves it, keep `["./plugins/withFocusUpProtection", { "familyControls": false }]` in `app.json` and
`IOS_APP_BLOCKING = false` in `src/config/release.ts`: the build then leaves out the entitlement and the three
Screen Time extensions (only the Live Activity is built) and signs without the approval.

## Android (Google Play)

### One-time setup

1. Use Android Studio's bundled JDK (the Intel JDKs in `~/Library/Java` cannot run on Apple Silicon).
   Add to `~/.zshrc`:
   ```sh
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   ```
2. Get the upload key. Play already knows Vaqtim's upload key: the one EAS created for the first cloud build
   (SHA1 `16:F4:B9:77:54:C1:F2:CA:30:39:62:62:46:FA:A0:37:45:3E:CE:6D`). A key made with `keytool` is
   rejected. Download it with `npx eas-cli@latest credentials -p android` → **credentials.json:
   Upload/Download** → **Download credentials from EAS to credentials.json**. That writes `credentials.json`
   and `credentials/android/keystore.jks` (both git-ignored; back them up).
3. Point `~/.gradle/gradle.properties` (never the repository) at that key, using the alias and passwords
   from `credentials.json`:
   ```properties
   FOCUSUP_UPLOAD_STORE_FILE=/Users/<you>/focusup/credentials/android/keystore.jks
   FOCUSUP_UPLOAD_KEY_ALIAS=...
   FOCUSUP_UPLOAD_STORE_PASSWORD=...
   FOCUSUP_UPLOAD_KEY_PASSWORD=...
   ```
   `plugins/withAndroidReleaseSigning.js` wires these into the generated `android/app/build.gradle`.
   Without them, release builds fall back to the debug key: they install, but Play rejects them.
   Check the signature with `keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab`.
4. Play App Signing is on (Google holds the app signing key). If the upload key is ever lost, use
   Play Console → App integrity → Upload key → **Request reset**.
5. After raising `android.versionCode` in `app.json`, regenerate `android/` (`npx expo prebuild --platform android`)
   before building, or Gradle keeps the old version code and Play rejects the upload.

Android real-app locking (Accessibility service) is **off** for now: `ANDROID_APP_BLOCKING` in
`src/config/release.ts` and `plugins/withAndroidAccessibility` `{ "enabled": false }` in `app.json`.
Turning it on needs Play's Accessibility declaration and a video ([launch/google-play.md](launch/google-play.md)).

### Build

```sh
npm run build:android
```

Upload `android/app/build/outputs/bundle/release/app-release.aab` in Play Console
(start with **Testing › Internal testing**). Play asks for the Accessibility service declaration
and Usage access explanation: answers are in [launch/google-play.md](launch/google-play.md).

## Fix the filters without a store release

Most Instagram, YouTube and TikTok fixes don't need a new App Store or Google Play build.

**1. Remote rules (minutes, no app change).** The app downloads [`website/public/blocker-config.json`](../website/public/blocker-config.json)
(served at `https://vaqtim.pages.dev/blocker-config.json`, re-checked at most every 15 minutes). A rule can switch a
filter off, add CSS selectors of things to hide, and add feed pages to block, for `instagram`, `youtube` and `tiktok`.
The app rejects anything else ([remoteBlockerConfig.ts](../src/services/remote-config/remoteBlockerConfig.ts)). Edit the
file, raise that platform's `version`, then `cd website && npm run deploy`. Example:

```json
{ "schemaVersion": 1, "platforms": { "tiktok": { "version": 2, "enabled": true, "features": {}, "selectors": { "forYouNavigation": ["[data-e2e=\"nav-home-new\"]"] } } } }
```

**2. Over-the-air updates (EAS Update, for code fixes).** Any change to JavaScript (the filter scripts, screens, text)
reaches phones without store review:

```sh
npm run update:publish -- "Fix Instagram Search tab"
```

Phones download it in the background on launch and use it from the next launch. An update only reaches builds with the
same `version` in `app.json` (`runtimeVersion.policy: appVersion`). **Native changes** (new native module, permissions,
plugins, Screen Time or Accessibility switches) need a new store build *and* a new `version` (for example 1.0.1), so an
update never lands on a build without the native code it needs. Test with a release build, not a development build.

## Try a release build on a phone first

```sh
npx expo run:ios --configuration Release --device
npx expo run:android --variant release --device
```

These use the same production settings but are not for store upload.
