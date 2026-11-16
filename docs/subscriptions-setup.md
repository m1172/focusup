# Vaqtim Pro and Family billing

The app uses Apple In-App Purchase and Google Play Billing through RevenueCat. Production purchases are off. Release both tiers together after the [Family device checks](family.md), store sandbox checks and owner approval.

| Tier | Monthly USD base price | Annual USD base price |
| --- | ---: | ---: |
| Pro | $1.99 | $14.99 |
| Family | $3.99 | $29.99 |

Choose the matching price points and verify Uzbekistan storefront availability in both consoles. The paywall uses the actual store currency and price, including the full annual charge. There are no trials or lifetime purchases. Family includes Pro for the parent and three child profiles with one supervised device each. Core blocking, existing free filters, grayscale, schedules, sleep and daily limits stay free.

## Store and RevenueCat setup

1. Confirm which products already exist under `com.m1172.focusup`. The names below are proposed identifiers. Keep any existing equivalent product and map it in RevenueCat. Resolve conflicts before creating duplicate products.
2. In App Store Connect, put `focusup_pro_monthly`, `focusup_pro_annual`, `focusup_family_monthly` and `focusup_family_annual` in one subscription group. Rank Family above Pro. Both periods of each tier share a level. Leave Apple subscription Family Sharing off. Add Uzbek, Russian and English copy wherever the storefront supports each locale, and attach the first subscriptions to the app review.
3. In Google Play Console, create `focusup_pro` and `focusup_family`, each with `monthly` and `annual` auto-renewing base plans. Activate Uzbekistan pricing and verify plan changes in the licensed test track. The app uses Play's same-product replacement without proration for period changes, immediate full-price replacement for upgrades and deferred replacement for downgrades. Verify the exact charge in the store sheet.
4. Add both apps to the same RevenueCat project for each environment. Import all products. Give Family products both `pro` and `family` entitlements. Put Pro in the `default` offering and Family in the `family` offering, each with the standard `$rc_monthly` and `$rc_annual` packages.
5. Set RevenueCat restore behavior to **Keep with original App User ID**. Connect App Store Server Notifications and Google real-time developer notifications through RevenueCat. Keep store private credentials in their consoles or RevenueCat, and use only public SDK keys in the mobile app.
6. The account owner completes Apple Business agreements, tax and payout setup, Apple Small Business enrollment, and Google merchant setup. Apple and Google approve the subscriptions through their standard review flows. See [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/) and [Google Play payments](https://support.google.com/googleplay/android-developer/answer/9858738).

## Backend and test environment

- Use a staging Supabase project and a separate RevenueCat project for sandbox QA. Apply `202611090002_billing.sql` before deploying the matching API. Never connect the sandbox API or webhook to the production database.
- Set `REVENUECAT_SECRET_KEY` to a server-side RevenueCat v1 secret API key, `REVENUECAT_WEBHOOK_SECRET` to a random value of at least 32 characters, and `REVENUECAT_ENVIRONMENT` to `SANDBOX` in staging or `PRODUCTION` in production. Configure the matching webhook environment and send `Authorization: Bearer <webhook secret>` to `/functions/v1/focusup-api/v1/webhooks/revenuecat`.
- In a local test checkout, turn on `PRO_ENABLED` and the Family switches listed in [Family setup](family.md). Point `EXPO_PUBLIC_API_URL` at staging. Set both platform-specific `EXPO_PUBLIC_REVENUECAT_*_API_KEY` values and HTTPS Terms and Privacy URLs. Use a development build for local QA and the approved sandbox/internal tracks for real store purchase tests.
- **Reviewers buy in the sandbox.** App Store review, TestFlight, Google Play review and Play licence testers all make test purchases from the production build. The production API therefore counts store-sandbox purchases as well as real ones (`REVENUECAT_SANDBOX_PURCHASES=allow`, the default). Without this a reviewer's purchase never unlocks anything and the app is rejected. Only people on your own tester lists and the stores' reviewers can make such purchases. To narrow it further, use RevenueCat → Project settings → General → "Allow testing entitlements and in-app currency for" (Anybody, allowed App User IDs, or Nobody); keep it on **Anybody** while a build is in review. `REVENUECAT_SANDBOX_PURCHASES=deny` turns them off on the server. Staging (`REVENUECAT_ENVIRONMENT=SANDBOX`) counts test purchases only.
- Send both Production and Sandbox events from the production RevenueCat project to the production webhook.
- Deleting a Vaqtim account also deletes its RevenueCat customer, so a store subscription that is still running can be restored to a new account.
- RevenueCat receives the opaque Vaqtim account ID, purchase data and SDK diagnostics needed for billing. It receives no child profile, social account or browsing data from this integration. The API keeps verified tier, store, product, expiry and webhook IDs. Family usage stays in Vaqtim's existing service.

## What the paywall must keep showing

`src/app/pro.tsx` is written to Apple's subscription rules (guideline 3.1.2, and Apple's "Clearly describing subscriptions" list) and Google Play's Subscriptions policy. Keep all of these when changing it:

| On the screen | Why |
| --- | --- |
| Plan name (Vaqtim Pro / Vaqtim Family) and the "What you get" list (`billing.proIncludes`, `billing.familyIncludes`) | Both stores: say what the price buys before asking to subscribe. Change the lists together with the features. |
| The store's own price string with the full period ("$14.99 / yr"), never a per-month figure for the annual plan | Apple: full renewal price, clear and prominent. Google: annual plans must not mainly show a monthly equivalent. |
| "You don't need a subscription to use Vaqtim…" (`billing.freeNote`) and the close button | Google: say whether a subscription is needed to use the app. |
| Name, price and period of the chosen plan, then renewal and how to cancel (`billing.billedAnnual` / `billedMonthly`, `billing.renewIos` / `renewAndroid`) | Both stores: renewal terms and how to cancel. |
| Each platform names only its own store | Apple guideline 2.3.10: no other platform or store names in the app. A subscription bought on the other platform shows `billing.otherStore` and no link (`manageSubscriptionUrl`). |
| Restore purchases | Apple: a way for current subscribers to restore. |
| Terms of Use and Privacy Policy links (the Subscribe button stays off until both URLs are set) | Apple: the app and the listing must both link to them. |
| "Manage subscription" for subscribers, reached from Settings → Vaqtim Pro | Google: an easy online way to cancel, in account settings or an equivalent page. |

Also keep: no paywall on a supervised child's phone (`familyRole === 'none'` route guard), no upsell text that promises something that is free or not built, and the "deleting your account does not cancel the subscription" note on the Account screen.

## Review and release

Provide a parent review account, test child setup steps, examples of each tier, and the paths to purchase, restore and manage. Explain that payment covers Vaqtim's premium tools and remote family management. The OS authorization flow and core app blocking remain free. Review the localized terms and privacy copy before publishing it. Update App Store privacy and Google Play Data safety answers to reflect the actual SDK configuration and data collected.

Test all four products, renewal, cancellation, pending payment, grace, refund, expiry and restore on both stores. Test incorrect-account restore, reinstall, same-account use on the other platform and changes between both tiers and billing periods. Confirm that one account with a current store purchase cannot buy again through the other store. On physical iPhone and Android devices, test that a fourth child is rejected and expiry preserves existing rules, hides the paid dashboard, and still allows the parent to clear blocks or unlink.

Before the switches go on, confirm on real phones that each line under "Vaqtim Pro" and "Vaqtim Family" on the in-app "Vaqtim features" page is true (`src/services/capabilities/features.ts`; the two groups appear only when `PRO_ENABLED` and `FAMILY_ENABLED` are on), and change a status there if a feature is not ready. Update the website and both store listings where they say Vaqtim is free: the app stays free to use, with optional subscriptions.

When testing and owner approval are complete, apply the approved production migration and API deploy, verify notifications and both offerings, and enable the Pro and Family switches together. Run the release preflight before the approved build. Monitor activation failures, webhook delivery and restore reports during rollout. Preserve the API, receipt reconciliation and supervised-device sync if new enrollment needs to be closed.
