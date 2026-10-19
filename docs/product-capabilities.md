# FocusUp product capability ledger

This is an implementation ledger, not a release or feature-parity claim. No feature is labelled Stable until it has passed real device and provider QA. Validation update: 2026-10-16. Work in this pass was limited to iOS; Android was not built or tested.

| Capability | iOS | Android | Current evidence / limits |
| --- | --- | --- | --- |
| Instagram optimized browser | Beta | Beta | Implemented WebView, semantic filters, local navigation guards and loading/error handling; logged-in device QA pending. |
| YouTube optimized browser | Beta | Beta | Search/watch/subscriptions remain allowed; Shorts/Home/related/comment controls implemented. Provider/device QA pending. |
| Original native apps | Simulator tested; native module compiled | Source implemented; unverified | Fresh iOS prebuild, module compilation and simulator launch passed. Simulator reports Screen Time unsupported; physical-device install is blocked while Developer Mode is off. |
| Native individual apps / categories | Compiled; real-device permission flow unverified | Eight known app packages; categories unsupported | iOS app and all extensions reference `group.com.m1172.focusup.protection`. Simulator cannot validate FamilyControls behavior. |
| Native Reels/Shorts section blocking | Unsupported | Unsupported | Whole-app protection only. No guessed view IDs or private screen-content scanning. |
| Original app shields | Extensions compiled; device behavior unverified | Source implemented | iOS Shield Configuration and Shield Action targets compile and embed in the simulator app. Real shield display/action not tested. |
| Redirect to cleaner version | iOS 26.5+ public shield action; device QA pending | Original-app handoff route; source implemented | A protected original app leads to `/native-app/<platform>`; ordinary browser entry opens the website directly. iOS 26.5+ uses `openParentalControlsApp`; older iOS requires opening FocusUp manually. Native protection stays active. |
| Temporary Access | Compiled; runtime unverified | 1–120 minutes, presets 5/10 | iOS native module and monitor extension compile; timer expiry/re-shield behavior needs a real device. |
| Routines / overnight routines | Compiled; runtime unverified | Implemented in-app; native source | iOS DeviceActivity monitor extension compiles; schedules and callbacks not exercised. |
| Sleep Mode | Compiled; runtime unverified | Implemented in-app; native source | iOS schedule source compiles; overnight, restart, timezone and DST behavior not tested. |
| Strict Mode | Compiled; runtime unverified | Implemented in-app; native source | iOS native module and monitor extension compile; precedence and enforcement not exercised. |
| Live Activity / Dynamic Island | Extension compiled; runtime unverified | Not applicable | Live Activity extension compiles and embeds in the simulator app; start/update/end and Dynamic Island behavior not tested. |
| Local mode reminders | Implemented | Implemented | Explicit notification opt-in. Strict completion, temporary-access completion, upcoming routine/Sleep starts. Start reminders cover the next seven days and refresh when the app runs. |
| Social message push notifications | Unsupported | Unsupported | FocusUp does not claim website message notification delivery. |
| Fullscreen / inline media / PiP | Provider dependent | Provider dependent | WebView native options enabled; no policy or player restrictions bypassed. |
| Background YouTube audio | Not forced | Not forced | Depends on provider/player/entitlement behavior. FocusUp does not intercept media URLs. |
| Instagram uploads / received media / Stories | Website controlled, unverified | Website controlled, unverified | Provider/browser capabilities and permissions apply. One-time media, saving, creator tools and unusual upload flows are not claimed supported. |
| Multiple website accounts | Website-controlled switching | Website-controlled switching | Shared local WebView session. No copied credentials or cookie exports. |
| Ten isolated account slots | Provider interface prepared | Provider interface prepared | `MAX_PRO_ACCOUNT_SLOTS = 10`; isolated store implementation is unavailable. No simulated switcher is shown. |
| Home feed hiding with Stories retained | Experimental, off by default | Experimental, off by default | Home-only post articles with permalink evidence are targeted. Profiles and Story containers are not targeted; actual DOM variants need QA. |
| Ads, Live, shopping distractions | Unavailable | Unavailable | Not marketed as working filters without reliable tested signals. |
| TikTok, Snapchat, X, Facebook, LinkedIn, Reddit optimized versions | Coming soon | Coming soon | Each has its own registry entry. Native whole-app protection source supports their selected apps/packages. |
| Measured statistics | Implemented | Implemented | Foreground social-browser time, explicit blocked web navigation, meaningful sessions/streak, and completed access-window counts. Access windows are not native usage time or saved time. |
| RevenueCat Pro / restore / management | Implemented; external setup pending | Implemented; external setup pending | Store SDK keys, products, Offering, legal pages and sandbox tests still needed. |
| Parent / family controls | Domain architecture only | Domain architecture only | Bounded policy model for app availability, limits, filters, downtime and account policy. No pairing, backend, managed child authorization or remote enforcement. Not sold as part of Pro. |
| Remote rules / kill switches | Implemented | Implemented | HTTPS, bounded schema, known features, constrained selectors within trusted containers, short-form path allowlist and versioning. Never downloaded JavaScript. |
| Clear local FocusUp data | Implemented | Implemented | Confirms before clearing settings, analytics, schedules, native selections and app WebView sessions. Store identity and unrelated storage are retained. Native browser clearing requires the module. |

## Release gates

The source implementation does not establish production readiness or full product parity. Required external/device work remains: enable Developer Mode on the paired iPhone; verify Apple Family Controls entitlement approval and signing for the app/extensions; complete a signed physical-device install; Android accessibility disclosure/declaration review; real provider account/login/media QA; Screen Time/Accessibility revocation and restart tests; timers across sleep, reboot, time-zone/DST changes; provider selector maintenance; RevenueCat/store products and sandbox purchases; real legal/support URLs; and light/dark/Uzbek/Russian/English device layout checks.

## iOS validation evidence

- Expo Doctor: 20/20 checks passed after moving `requireOptionalNativeModule` to the SDK `expo` export and removing the direct `expo-modules-core` dependency.
- iOS prebuild: passed with the local FocusUp config plugin. It generated one app target and one each of FocusUpMonitor, FocusUpShield, FocusUpShieldAction, and FocusUpLiveActivity.
- CocoaPods: installation passed.
- Xcode: simulator app build and unsigned generic iOS arm64 build passed, including the four extensions and FocusUp native module.
- Simulator: iPhone 18 Pro / iOS 27.0 opened FocusUp to its Uzbek-language Focus tab. This does not validate Screen Time enforcement.
- Physical iPhone: iPhone 15 Pro / iOS 27.0.1 is paired, but Xcode could not build/install because Developer Mode is disabled. No device behavior was tested.
- FamilyControls and ManagedSettings calls are not validated: the simulator reports Screen Time unsupported, and the paired phone could not be used. Apple Developer entitlement/provisioning still needs verification for physical use and distribution.
- RevenueCat initialization reported an unknown error in simulator logs. Store offering/purchase behavior was not tested; keys and products remain external setup.
- This pass did not validate navigation gestures, theme switching, deep links, notification permission, subscriptions, schedules, shields, temporary access, or Live Activity runtime behavior.

The unsupported account-isolation, provider media/notification, native-section and family backend categories remain explicit gaps. They must not be enabled by a marketing label or fixture.
