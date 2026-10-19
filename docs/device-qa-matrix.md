# iOS device QA matrix

Validation date: 2026-10-16. Scope: iOS only. No Android build or Android device testing was performed in this pass.

| Platform | OS version | Device | Feature | Steps | Expected | Actual | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iOS | 27.0 | iPhone 18 Pro Simulator | CNG prebuild | Run `npx expo prebuild --platform ios --no-install` | Generate app and configured extension targets | Generated FocusUp plus Monitor, Shield, Shield Action, and Live Activity targets | PASS | No hand-edited iOS sources were required; the local config plugin recreated the project. |
| iOS | 27.0 | iPhone 18 Pro Simulator | CocoaPods | Run Expo iOS build after prebuild | Resolve and install pods | CocoaPods installed successfully | PASS | Expo native module autolinking included FocusUpProtection. |
| iOS | 27.0 | iPhone 18 Pro Simulator | Native compile | Run `npx expo run:ios --device <simulator-udid>` | Compile app, native module, and embedded extensions | Xcode build succeeded with 0 errors; all four extensions compiled and embedded | PASS | Two build warnings remained: Expo Dev Launcher script dependency warning and ExpoModulesCore provider warning. |
| iOS | iOS 27.1 SDK | Generic iPhone arm64 | Device-architecture compile | Run `xcodebuild ... -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build` | Compile app and extensions for physical iOS architecture | Xcode reported `BUILD SUCCEEDED` | PASS | Unsigned compile only; it does not prove signing, installation, entitlement authorization, or runtime behavior. |
| iOS | 27.0 | iPhone 18 Pro Simulator | Extension packaging | Inspect built app `PlugIns` bundles and Info.plists | Each extension has executable and expected extension point | Monitor, Shield Configuration, Shield Action, and Live Activity bundles contain executables and expected extension points | PASS | All targets share `group.com.m1172.focusup.protection`. |
| iOS | 27.0 | iPhone 18 Pro Simulator | App install and launch | Install/open build with Expo CLI; inspect simulator screen and process | App opens without a native module or resource crash | FocusUp opened to the Uzbek Focus tab; app process remained running | PASS | This was a launch smoke check, not a full navigation walkthrough. |
| iOS | 27.0 | iPhone 18 Pro Simulator | Localization | Inspect launched Focus screen | Selected locale renders translated content | Uzbek text rendered on the Focus screen | PASS | Russian and English were not checked in this pass. |
| iOS | 27.0 | iPhone 18 Pro Simulator | FamilyControls authorization and picker | Request authorization and select applications | Authorization state and picker persist tokens | Not run; Screen Time APIs report unsupported in Simulator | NOT TESTED | Simulator behavior cannot validate physical Screen Time flows. |
| iOS | 27.0 | iPhone 18 Pro Simulator | Shields, schedules, Strict Mode, Temporary Access | Exercise protected apps, monitor callbacks, and expiry | Protection activates, expires, and reconciles | Not run | NOT TESTED | Requires a supported physical device and usable Family Controls entitlement. |
| iOS | 27.0 | iPhone 18 Pro Simulator | Live Activity runtime | Start, update, and end a Live Activity | Activity appears and updates correctly | Not run | NOT TESTED | Extension compilation passed; presentation/runtime behavior was not exercised. |
| iOS | 27.0 | iPhone 18 Pro Simulator | RevenueCat startup | Launch and inspect development logs | SDK initializes or reports a handled configuration error | Initialization logged an unknown error; the app remained open | FAIL | No offering or purchase flow was tested. Store keys/products remain unconfigured or unverified. |
| iOS | 27.0 | iPhone 18 Pro Simulator | Theme switching, navigation walkthrough, deep links, notifications | Exercise each user flow | Controls and routes work without crash | Not run | NOT TESTED | Only the currently rendered Focus tab was inspected. |
| iOS | 27.0.1 | iPhone 15 Pro (physical) | Device build/install | Run `npx expo run:ios --device <device-udid>` | Sign, install, and launch on device | Xcode timed out because Developer Mode is disabled on the paired iPhone | BLOCKED EXTERNALLY | Device testing requires the owner to enable Developer Mode in Settings → Privacy & Security, then retry. No device installation occurred. |
| iOS | 27.0.1 | iPhone 15 Pro (physical) | Family Controls entitlement and provisioning | Install signed build and request Screen Time authorization | Entitlements are provisioned and authorization succeeds | Not reached | BLOCKED EXTERNALLY | Confirm Family Controls capability and App Group provisioning in Apple Developer account after Developer Mode is enabled. |

## JavaScript validation

| Check | Result |
| --- | --- |
| Expo Doctor | PASS — 20/20 checks |
| TypeScript (`npx tsc --noEmit`) | PASS |
| ESLint (`npm run lint`) | PASS |
| Jest (`npm test`) | PASS — 17 suites, 96 tests |

## Out of scope

Android validation was intentionally deferred to honor the iOS-only instruction. No real Screen Time protection, subscription purchase, full UI navigation, WebView provider flow, schedule callback, restart, timezone/DST, permission revocation, or real-device behavior is claimed as tested.

## Native app handoff update — 2026-10-17

- The updated iOS app and shield extensions built for iPhone 18 Pro Simulator with zero errors and two existing warnings. Shield Action now uses the public iOS 26.5+ `openParentalControlsApp` response; the host consumes a short-lived App Group destination. The extension's privacy manifest declares its App Group defaults access.
- From FocusUp Home, tapping Instagram went directly to the website loading view, without the purple launch page.
- Opening `focusup://native-app/instagram` displayed the purple launch page. This exercises the route used by native interception; it does not simulate a real Screen Time shield or authorize protection.
- The handoff bridge tests cover supported destinations, rejected arbitrary payloads, native errors, and binaries missing the new native method. TypeScript and ESLint passed.
- Physical-device authorization, app selection, original Instagram shielding, the shield button handoff, and Android native execution remain unverified. To check on an authorized physical iPhone: enable native protection for Instagram, open the original Instagram app, confirm its system shield, choose Open FocusUp, then open the cleaner browser and verify that the original Instagram app is still shielded.

## Full-screen browser update — 2026-10-17

- Rebuilt and installed the iOS app on iPhone 18 Pro Simulator: zero errors and two existing build warnings. The browser now uses a full-screen modal with controller-managed iOS status-bar visibility.
- Checked Instagram Home and messages: headers remain below the camera cutout, the cutout area matches the website background, and the four bottom navigation items remain evenly spaced. The native session header is hidden in full-screen mode.
- Checked Stories: no native top or bottom padding surrounds the viewer, the status bar is hidden, and the close/reply controls remain reachable. Switching between full screen and browser controls preserved the Story session and restored status-bar visibility.
- Targeted viewport, message-validation, Instagram content, navigation, and translation tests pass (68 tests). ESLint and TypeScript pass. Physical-device and Android presentation checks remain pending.

## Instagram Search update — 2026-10-17

- On iPhone 18 Pro Simulator, tapping the bottom Search icon from Home opened Instagram's Search/Recent view automatically, with its existing search history and Cancel control.
- The iOS input accessory toolbar (previous/next/Done) no longer covers the website's bottom navigation. The search input remained focused and editable.
- Search navigation and Instagram content regression tests passed (15 tests); ESLint and TypeScript passed. No native rebuild or dependency change was needed.

## Cloud account checks

Use a fresh development build with configured Supabase/provider credentials and the email-code templates. Automated tests and JS export do not cover native consent screens.

- Open Settings → Your account on a small phone in Uzbek, Russian and English, light/dark mode and with the keyboard visible.
- Register/confirm an email code, resend it, sign in, recover the password, and terminate/reopen the app during recovery.
- Complete and cancel native Apple sign-in on iOS and Google/Telegram OAuth on both platforms. Background/kill the app during consent and test valid, expired and unsolicited callbacks.
- Sign out during a slow refresh and reopen the app; the old account must not return. Test offline sign-out and local privacy-data clearing.
- Back up from two devices, confirm a stale save produces a conflict, refresh explicitly and choose which copy to retain.
- Restore with notification permission denied and with Strict Mode/a strict routine active. Verify native app selections, temporary access and RevenueCat entitlement remain unchanged.
- Export account JSON through the share sheet and verify that passwords, tokens, analytics, cookies and browsing content are absent.
- Delete only the backup, then delete the cloud account with DELETE confirmation. Local settings must remain; store subscriptions must still be managed in the store.
