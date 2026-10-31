# Launch checklist: Vaqtim 1.0

Everything needed to publish the iOS app, the Android app and vaqtim.com, in order. **You** = needs your accounts, card or phone. **Ready** = prepared in this repository.

| # | Step | Who | Status |
|---|---|---|---|
| 1 | Request Family Controls (Distribution) for 4 bundle IDs: [app-store.md §1](app-store.md#1-family-controls-distribution-entitlement-do-this-first) | You | To do; takes 1–3 weeks, start now |
| 2 | Buy vaqtim.com on Cloudflare Registrar (about $10.46/year) | You | To do |
| 3 | Publish the website (below) | You (login) + Ready | Site and deploy command ready |
| 4 | Forward support@vaqtim.com with Cloudflare Email Routing | You | To do |
| 5 | Custom SMTP in Supabase so sign-up emails reach real users ([docs/backend-setup.md](../backend-setup.md)) | You | To do |
| 6 | Create the app in App Store Connect and put its Apple ID in `eas.json` → `submit.production.ios.ascAppId` | You | To do |
| 7 | Create the app in Google Play Console (personal account: closed test with 12 testers for 14 days is required before production) | You | To do |
| 8 | Create a Vaqtim demo account for Apple and Google reviewers | You | To do |
| 9 | Store listings: App Store ([store.config.json](../../store.config.json)), Google Play ([google-play.md](google-play.md)) in English, Russian and Uzbek | Ready | Done |
| 10 | Privacy answers: App Privacy ([app-store.md §4](app-store.md#4-app-privacy-the-privacy-nutrition-label)), Data safety ([google-play.md](google-play.md#data-safety)) | Ready | Done |
| 11 | Age rating, content rating, Accessibility declaration, review notes | Ready | Done |
| 12 | Production config: iPhone-only, privacy/terms URLs in the build (`.env.production`, checked by `npm run release:check`) | Ready | Done; support email waits for step 4 |
| 13 | Screenshots and Google Play feature graphic (below) | You (capture) + me (frames) | To do |
| 14 | Test on a real Android phone (never done yet) | You | To do |
| 15 | Local builds: `npm run build:ios && npm run upload:ios`, `npm run build:android` ([local-release-build.md](../local-release-build.md)) | You (Xcode login, Android upload key) | After 1 and 6 |
| 16 | TestFlight and Play internal test; then closed test (12 testers × 14 days for personal Play accounts) | You | After 15 |
| 17 | Submit for review | You | After 16 |

## Decided

- **Google Play account:** personal, so the 12-tester, 14-day closed test is required. Start it as soon as the first Android build passes internal testing.
- **App functionality:** Reels, Shorts and TikTok's For You are always hidden inside Vaqtim (free users cannot turn this off). Adding an app on the Protect tab also asks to block the original app.
- **Parent controls:** not part of 1.0.

## Website

```bash
cd website
npm install
npx wrangler@4.149.0 login     # once: opens Cloudflare in the browser
npm run deploy                 # builds and uploads to the Cloudflare Pages project "vaqtim"
```

The first deploy creates the project and gives a free address, `vaqtim.pages.dev`. Then in Cloudflare → Workers & Pages → vaqtim → **Custom domains**, add `vaqtim.com` and `www.vaqtim.com`. The privacy, terms, support and delete-account links used in the apps and store forms (`/privacy/`, `/terms/`, …) work from the first deploy. More in [website/README.md](../../website/README.md).

## Screenshots

| Store | Size | Count |
|---|---|---|
| App Store (iPhone 6.9") | 1320 × 2868 | 4–6 per language |
| Google Play (phone) | 1080 × 1920 or larger, 9:16 | 4–8 per language |
| Google Play feature graphic | 1024 × 500 | 1 |

Suggested screens, each with a short caption above the phone:
1. Instagram feed in Vaqtim with the Reels tab gone: "Instagram, without Reels"
2. YouTube home without Shorts: "YouTube, without Shorts"
3. The purple "Open Instagram in Vaqtim" shield: "The real app sends you back"
4. Statistics: "See the time you get back"
5. Onboarding result (the 19% / day ring): "Know what short videos cost you"

Take raw screenshots on your iPhone and an Android phone, signed in with a test account, in each language. I can then put them in branded frames at the exact store sizes.

## Commands reference

```bash
eas build -p ios --profile production
eas build -p android --profile production
eas submit -p ios --profile production       # TestFlight / App Store Connect
eas submit -p android --profile production   # Play internal track (after the first manual upload)
eas metadata:push                            # App Store listing from store.config.json
```
