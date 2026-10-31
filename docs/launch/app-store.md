# App Store: everything to fill in

Bundle ID: `com.m1172.focusup`. Team: `GH6PP8FUU8`. App name: **Vaqtim**. The listing text (English and Russian) is in [`store.config.json`](../../store.config.json) and is uploaded with `eas metadata:push`. App Store Connect does not offer Uzbek as a listing language.

## 1. Family Controls distribution entitlement (do this first)

Blocking the original Instagram and YouTube apps uses Screen Time (Family Controls). Development builds work without Apple's approval; **TestFlight and App Store builds don't**. Request it at developer.apple.com → Account → *Request Family Controls (Distribution)*, once for each of these bundle IDs:

| Bundle ID | Target |
|---|---|
| `com.m1172.focusup` | App |
| `com.m1172.focusup.FocusUpShield` | Shield configuration extension |
| `com.m1172.focusup.FocusUpShieldAction` | Shield action extension |
| `com.m1172.focusup.FocusUpMonitor` | Device activity monitor extension |

Text for the request:

```
Vaqtim helps people use Instagram and YouTube without short-video feeds (Reels and Shorts). The app opens these services in a filtered in-app browser. When the user turns on a Reels or Shorts filter, Vaqtim asks for individual Screen Time authorization (AuthorizationCenter, .individual) and lets the user choose the original app in FamilyActivityPicker. ManagedSettings then shields that app; the shield (ShieldConfiguration and ShieldAction extensions) offers a single button that opens the filtered version in Vaqtim. A DeviceActivity monitor extension keeps the selection in effect. The user can turn this off at any time. Selections are opaque tokens stored only on the device in our App Group and are never sent to our servers.
```

Approval often takes one to three weeks. While waiting, everything else below can be done.

## 2. Create the app in App Store Connect

My Apps → **+** → New App: platform iOS, name **Vaqtim** (if taken, use the full title `Vaqtim: Block Reels & Shorts`), primary language English (U.S.), bundle ID `com.m1172.focusup`, SKU `vaqtim-ios`.

Then copy the app's **Apple ID** (a number under App Information) into `eas.json` → `submit.production.ios.ascAppId`, so `eas submit` and `eas metadata:push` know which app to use.

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

- **Sign-in required:** Yes. Create a Vaqtim account just for Apple (email + password) and enter it under *Sign-in information*. Don't use your personal account.
- **Contact:** your name, email and phone (with country code).
- **Notes** (paste):

```
Vaqtim lets people use Instagram and YouTube without short-video feeds.

How to review:
1. Sign in with the demo account above (Continue with email → Sign in).
2. On Home, tap the filters row under YouTube and turn on the Shorts filter. Vaqtim first explains that it will block the original YouTube app, asks for Screen Time permission, and opens Apple's app picker: choose YouTube there (the YouTube app needs to be installed on the device to appear in the picker).
3. Open YouTube from Home. YouTube works without signing in; the Shorts shelf and Shorts tab are hidden.
4. Open the original YouTube app from the Home Screen: a Vaqtim shield appears with one button that opens the filtered version in Vaqtim.
5. Instagram works the same way, but needs the reviewer's own Instagram account to show content.

The user can turn blocking off at any time. Screen Time selections are opaque tokens that stay on the device.

The user signs in to Instagram and Google on their own websites inside the app. Vaqtim never receives social media passwords. Account deletion is in Settings → Account → Delete account.

Vaqtim is not affiliated with Meta or Google; the content is loaded from their public websites with the user's own account.
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
- **Guideline 2.3.7 (trademarks in metadata):** the title uses "Reels" and "Shorts" descriptively. If Apple objects, change the title to `Vaqtim: Less Short Videos` and resubmit; nothing else needs to change.
- **Guideline 4.2 (minimum functionality):** reviewers sometimes call web-view apps "just a website". The Screen Time blocking, statistics and native onboarding are what make Vaqtim more than a browser; mention them if asked.
