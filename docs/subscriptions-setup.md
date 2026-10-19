# FocusUp Pro subscription setup

FocusUp uses `react-native-purchases` and `react-native-purchases-ui` 10.14 with one RevenueCat entitlement named `pro`. Monthly and Annual packages grant the same entitlement. Purchases are completed by RevenueCat and store customer information is the source of truth; FocusUp does not persist an independent Pro flag.

## App Store Connect

1. Confirm the app record and bundle ID `com.m1172.focusup`.
2. Enable In-App Purchase for the app identifier in Apple Developer configuration and confirm Paid Apps agreements, tax and banking setup in App Store Connect.
3. Create a subscription group, then add Monthly and Annual auto-renewable subscriptions. Suggested product identifiers are `focusup_pro_monthly` and `focusup_pro_annual`; these are examples only. The identifiers in App Store Connect must exactly match the RevenueCat products.
4. Configure the actual regional prices and storefront localizations in App Store Connect. Add localized display names, descriptions, and review information required by Apple's submission flow.
5. Connect the App Store app to RevenueCat using App Store Connect credentials kept in RevenueCat's secure dashboard. Never add private keys to this repository or the mobile app.

## Google Play Console

1. Create the app using package name `com.m1172.focusup` and upload a signed build to an internal testing track.
2. Create one subscription product with Monthly and Annual base plans. Suggested product identifiers are the same examples above, but the actual Play product and base-plan configuration must be reflected in RevenueCat.
3. Set regional prices and activate the subscription and base plans. Add licensed testers and verify the account can access the testing track.
4. Connect Google Play to RevenueCat with a service account configured in RevenueCat. Keep service-account credentials out of the app and repository.

## RevenueCat dashboard

Configure the project in this order:

1. Add the iOS app with bundle ID `com.m1172.focusup` and the Android app with package name `com.m1172.focusup`.
2. Add and import the matching App Store Connect and Google Play products. Confirm package type and billing period map to Monthly and Annual.
3. Create the single entitlement `pro` and attach both subscription products/base plans.
4. Create or select the `default` Offering, then add the Monthly and Annual packages. The app safely handles either package being absent and shows a retry state when no current/default Offering is returned.
5. Configure Customer Center in RevenueCat if you want its subscription support and management screens to show dashboard-managed options.

No store products or RevenueCat Offering are configured by this source change. The IDs in `subscriptionConfig.ts` are examples, not verified products.

## Environment

Set these client-safe public SDK keys in `.env` for local development or in the matching EAS development/production environments:

```sh
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
```

Use only RevenueCat's public SDK key for each platform. Never use RevenueCat secret API keys, App Store private keys, or Google service-account keys in the app. Configure real HTTPS legal pages before release:

```sh
EXPO_PUBLIC_TERMS_URL=
EXPO_PUBLIC_PRIVACY_POLICY_URL=
```

The paywall hides legal links until valid HTTPS URLs are configured; it does not invent a FocusUp legal domain.

## Development and store testing

Expo Go can preview UI only where the installed RevenueCat SDK provides its Preview API. It does not validate App Store or Google Play billing. Use an Expo Development Build or production build for real store purchase flows. This repository already includes `expo-dev-client` and the RevenueCat native packages. Regenerate/rebuild the native app after native dependency or Expo configuration changes.

For iOS, test using StoreKit configuration or an App Store sandbox tester, then verify against the App Store Connect sandbox product setup. For Android, use a Play internal testing track with licensed tester accounts and test payment methods. RevenueCat Test Store can help validate app wiring during development, but it does not replace each store's final purchase and restore checks. Test new purchase, user cancellation, pending purchase, already-owned product, restore with an active entitlement, restore with no entitlement, app restart, and cancellation/renewal status updates.

The project has a generated iOS Xcode project and installed Pods. Its app target currently has no explicit In-App Purchase entitlement entry; enable the App Store capability as required when preparing the App ID and distribution profile. This source-only task did not run an Xcode build or test a store transaction. There is no checked-in `android/` native project and no custom Android Activity launch mode in `app.json`; Expo managed prebuild supplies the native Activity configuration. No launch-mode override was added. Review the generated Android manifest in the first development build to ensure its default Activity configuration supports store flows that can background the app for payment verification.

## Feature access

Free includes Instagram Reels blocking (including the DM Reel scroll guard), YouTube Shorts blocking, today's basic usage, and today's blocked-attempt count. Pro unlocks Recent search navigation with Cancel returning Home, Instagram Explore/suggested posts/recommendations controls, YouTube Home/related recommendations and comments controls, Strict Mode, schedules, and week/month/year statistics. Sponsored/promotional-content filtering remains experimental and is not advertised as a guaranteed feature. A downgrade keeps free Reels protection and disables Pro features while preserving saved preferences.

All paywall source analytics are coarse allowlisted placements such as `settings`, `strict_mode`, or `instagram_explore`; they never include social account data or browsing content. RevenueCat receives subscription and transaction data required for store services, not FocusUp social activity.
