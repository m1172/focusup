# App Store: everything to fill in

Bundle ID: `com.m1172.focusup`. Team: `GH6PP8FUU8`. App name: **Vaqtim**. The listing text (English and Russian) is in [`store.config.json`](../../store.config.json) and is uploaded with `eas metadata:push`. App Store Connect does not offer Uzbek as a listing language.

## 1. Family Controls distribution entitlement

Locking the original Instagram, YouTube and TikTok apps uses Screen Time (Family Controls). TestFlight and App Store builds need Apple's distribution approval for it.

- **Requested:** 31 October 2026 (request ID `V27JP2FB77`).
- **Approved:** confirmed 2 November 2026. The App Store provisioning profiles for `com.m1172.focusup`, `.FocusUpMonitor`, `.FocusUpShield` and `.FocusUpShieldAction` now include `com.apple.developer.family-controls`.
- **Switched on from iOS build 5:** `IOS_APP_BLOCKING = true` in `src/config/release.ts` and `{ "familyControls": true }` in `app.json`. Builds 2–4 shipped without it. iOS has its own `ios.runtimeVersion` (`1.0.0-screentime`), so over-the-air updates for build 5 never reach those older builds.
- To turn it off again, set both switches back and change `ios.runtimeVersion`.

## 2. Create the app in App Store Connect

My Apps → **+** → New App: platform iOS, name **Vaqtim** (if taken, use the full title `Vaqtim: Block Reels & Shorts`), primary language English (U.S.), bundle ID `com.m1172.focusup`, SKU `vaqtim-ios`.

Done on 31 October 2026: the app's Apple ID is **6829294178** (saved in `eas.json` → `submit.production.ios.ascAppId`). China mainland is switched off in Pricing and Availability (it needs an ICP filing number, and the social sites are blocked there).

## 3. App Information

- **Category:** Productivity (primary), Social Networking (secondary). Set by `store.config.json`.
- **Content rights:** the app shows third-party content (Instagram and YouTube) that users access with their own accounts. Answer "Yes, it contains third-party content" and confirm you have the right to use it in this way, as the content is loaded from the services' own websites.
- **Age rating** (answer the questionnaire; Apple calculates the rating):
  - The app itself has no violence, sexual content, profanity, gambling, horror, drugs or medical content. But it opens Instagram and YouTube, which contain user posts, so answer like a social app: **Infrequent/Mild** for mature/suggestive themes, profanity or crude humor, realistic violence and alcohol/tobacco references; **None** for the rest.
  - **User-generated content: Yes. Messaging and chat: Yes** (Instagram messages).
  - **Unrestricted web access: No.** The in-app browser only opens Instagram, YouTube and their sign-in pages; other links open in Safari.
  - **Advertising: No. Gambling and contests: No. Parental controls: No.**
  - Expect a teen rating (13+ or 16+). That is normal for apps that open social networks.
- **Export compliance:** already answered in the build (`ITSAppUsesNonExemptEncryption = false`; the app only uses standard HTTPS).

## 4. App Privacy (the privacy "nutrition label")

**Do you or your third-party partners use data for tracking?** No. There are no ads and no cross-app tracking.

| Data type | Linked to the user | Used for |
|---|---|---|
| Contact Info → Email Address | Yes | App Functionality |
| Contact Info → Name | Yes | App Functionality |
| User Content → Customer Support | Yes | App Functionality (support chat) |
| User Content → Other User Content | Yes | App Functionality (settings backup) |
| Identifiers → User ID | Yes | App Functionality, Analytics |
| Identifiers → Device ID | Yes | App Functionality (push notification token) |
| Usage Data → Product Interaction | Yes | Analytics (events and session replay of Vaqtim's own screens) |
| Usage Data → Other Usage Data | Yes | Analytics (weekly app-usage minutes) |
| Diagnostics → Crash Data | Yes | App Functionality, Analytics |
| Diagnostics → Other Diagnostic Data | Yes | Analytics |

Not collected: location, health, financial info, contacts, browsing history, search history, photos/videos, audio, sensitive info. Social network passwords and content stay inside the website on the device and are not collected.

When paid plans launch, add **Purchases → Purchase History** (App Functionality).

**Privacy Policy URL:** `https://vaqtim.pages.dev/en/privacy/` (set by `store.config.json`).

## 5. App Review information

- **Sign-in required:** Yes. Use the same reviewer account as Google Play: `vaqtim.review@gmail.com` (the password is in Play Console → App content → Sign in details; never put it in the repository).
- **Contact:** your name, email and phone (with country code).
- **Notes** (paste):

```
Vaqtim lets people use Instagram, YouTube and TikTok without short-video feeds (Reels, Shorts and the For You feed).

How to review:
1. Sign in with the demo account above: on the first screen choose "Continue with email" → "Sign in", then enter the email and password. The account is already confirmed, so no verification code is needed.
2. On Home, open YouTube. YouTube works without signing in; the Shorts shelf and the Shorts tab are hidden, while regular videos, search and subscriptions work.
3. Open Instagram or TikTok from Home. Reels and the For You feed are hidden; messages, profiles and posts stay. These need the reviewer's own Instagram or TikTok account to show content.
4. On the Protect tab, tap an app's plus button to add it. Vaqtim explains the Screen Time permission, then iOS asks for it and shows Apple's app picker; choose the same app there. The original app is then locked: opening it shows a Vaqtim screen that leads back to the clean version inside Vaqtim. Removing the app on the Protect tab unlocks it again.
5. The Statistics tab shows how much time short videos were taking and how much the user gets back.

The user signs in to Instagram, Google and TikTok on their own websites inside the app. Vaqtim never receives social media passwords. Account deletion is in Settings → Account → Delete account.

Screen Time (Family Controls) is used only to lock the apps the user picks in Apple's own picker. The choices stay on the device and are never sent to our servers.

Vaqtim is not affiliated with Meta, Google or ByteDance; the content is loaded from their public websites with the user's own account.
```

## 6. Screenshots

iPhone only (`supportsTablet` is off, so no iPad screenshots are needed). Required size: **6.9-inch, 1320 × 2868** (or 6.5-inch 1284 × 2778). Smaller iPhones reuse these. Up to 10 per language; 4–6 is plenty. See the plan in [README.md](README.md).

## 7. Build, upload and submit

```bash
eas build -p ios --profile production      # signs and builds in the cloud
eas submit -p ios --profile production     # uploads to App Store Connect / TestFlight
eas metadata:push                          # uploads the listing from store.config.json
```

Then in App Store Connect: test in TestFlight, attach the build to version 1.0, add screenshots, and **Submit for Review**. `store.config.json` sets manual release with phased rollout, so after approval you press *Release* yourself and it reaches all users over 7 days.

## Review risks to know

- **Guideline 5.2.2 (third-party content):** Apple can ask whether you have permission to show Instagram and YouTube. The notes above explain that users load the services' public websites with their own accounts, as similar apps on the App Store do. If Apple asks, answer in Resolution Center with the same explanation.
- **Guideline 4.3 (similar apps):** build 6 was rejected on 7 November 2026 because its feature set matched many other apps. For build 8 the onboarding was cut from 10 steps to 4 (the age, "why", life-in-weeks, "instead", goals and hold-to-commit screens were removed) and the listing was renamed from "Block Reels & Shorts" to "Calm Social Media". The app's features did not change. A bigger alternative, task-focused sessions, is kept in the git stash "build 7: task-focused sessions".
- **Guideline 2.3.7 (trademarks in metadata):** the description and keywords mention "Reels" and "Shorts" descriptively. If Apple objects, remove them; nothing else needs to change.
- **Guideline 4.2 (minimum functionality):** reviewers sometimes call web-view apps "just a website". Version 1.0 has no Screen Time blocking, so this risk is higher: point to the filters that run on top of three services, the statistics, the Live Activity and the native onboarding if asked.
