# Build store releases locally (no EAS)

Release builds are made on this Mac with Xcode and Gradle. `ios/` and `android/` stay generated
(Continuous Native Generation): change native behavior in `app.json` and `plugins/`, never by hand.

## Before every release

1. Bump the version in `app.json`:
   - `expo.version` (user-visible, e.g. `1.0.1`) when shipping a new version.
   - `expo.ios.buildNumber` (string) and `expo.android.versionCode` (integer) on **every** upload;
     the stores reject a build number they have already seen.
2. Check `.env.production` (copy from `.env.production.example`). Release builds bundle JavaScript
   in production mode, which loads `.env.production` over `.env`. Only public values belong here.
3. Run the checks:
   ```sh
   npm run lint && npm run typecheck && npm test
   ```
4. Regenerate the native projects so they match `app.json`:
   ```sh
   npm run native:sync
   ```
   If `pod install` fails with `Encoding::CompatibilityError`, add `export LANG=en_US.UTF-8` to `~/.zshrc`.

## iOS (App Store / TestFlight)

Team `GH6PP8FUU8` is set in `app.json` (`ios.appleTeamId`); Xcode manages certificates and profiles.

```sh
npm run build:ios
```

This archives to `build/FocusUp.xcarchive`. Upload it from Xcode: **Window › Organizer › Archives ›
Distribute App › App Store Connect**. Alternatively open `ios/FocusUp.xcworkspace`, choose
**Any iOS Device**, then **Product › Archive**.

The app ships four extensions (Family Controls monitor/shield/shield action and a Live Activity).
Each needs a distribution profile, and Family Controls needs Apple's **distribution** entitlement
approval for every extension bundle ID, not only the development entitlement.

## Android (Google Play)

### One-time setup

1. Use Android Studio's bundled JDK (the Intel JDKs in `~/Library/Java` cannot run on Apple Silicon).
   Add to `~/.zshrc`:
   ```sh
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   ```
2. Create the upload key **outside the repository** and back it up (a lost upload key needs a
   Play Console reset):
   ```sh
   mkdir -p ~/keys && keytool -genkeypair -v -keystore ~/keys/focusup-upload.keystore -alias focusup-upload -keyalg RSA -keysize 2048 -validity 10000
   ```
3. Add the signing values to `~/.gradle/gradle.properties` (never to the repository):
   ```properties
   FOCUSUP_UPLOAD_STORE_FILE=/Users/<you>/keys/focusup-upload.keystore
   FOCUSUP_UPLOAD_KEY_ALIAS=focusup-upload
   FOCUSUP_UPLOAD_STORE_PASSWORD=...
   FOCUSUP_UPLOAD_KEY_PASSWORD=...
   ```
   `plugins/withAndroidReleaseSigning.js` wires these into the generated `android/app/build.gradle`.
   Without them, release builds fall back to the debug key: they install, but Play rejects them.
4. Enrol in Play App Signing when creating the app in Play Console (the default).

### Build

```sh
npm run build:android
```

Upload `android/app/build/outputs/bundle/release/app-release.aab` in Play Console
(start with **Testing › Internal testing**).

## Try a release build on a device or simulator first

```sh
npx expo run:ios --configuration Release
npx expo run:android --variant release
```

These use the same production environment but are not for store upload.
