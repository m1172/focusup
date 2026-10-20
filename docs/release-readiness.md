# Authenticated free-feature release readiness

Audit date: 19 October 2026. This document records verified evidence and remaining release work. It does not authorize deployment or store submission.

## Release behavior

`src/config/release.ts` sets `PRO_ENABLED = false`. Reels and Shorts filtering, daily statistics, account settings and backups remain available after authentication. Pro routes, controls, labels and billing operations are disabled. Source code, purchase dependencies, entitlements and saved premium settings are retained.

Every current root route is explicitly declared in the navigator, with tests that detect omitted routes. Application routes require hydrated preferences, a configured backend, a securely restored account, completed onboarding and no outstanding password recovery. Onboarding, authentication callbacks, privacy, help and capability information remain public. There is no guest bypass when cloud configuration is missing. Registering without completing email verification grants no app access.

Sign-out clears local account access before waiting on secure storage or server sign-out. Server revocation is best effort using the cached access token; a device with no cached access token reports local sign-out. Restored accounts can use the app offline. Refresh rejection revokes access; network failure retains it. This is the deliberate offline policy, so revocation on another device cannot be detected while offline.

Hidden native plans are replaced with an empty plan when native authorization permits. Saved routines, native selections, temporary access and Strict Mode configuration remain stored. Background reconciliation cannot restart those protections or their reminders in this release. Restoring a backup preserves hidden preferences but leaves them inactive.

## Release blockers and follow-up

| Severity | Finding and evidence | Required action |
| --- | --- | --- |
| Blocker | Local public Terms URL, Privacy Policy URL and support email are empty. Production EAS environment values could not be inspected. The in-app privacy information exists; the registration Terms link needs a published URL. | Publish the legal pages and supply `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_SUPPORT_EMAIL` in the production EAS environment. Verify links and support delivery in a release build. |
| Blocker: unverified | Live `/v1/auth/providers` reports email/password enabled and no OAuth providers. The existing deployment notes identify custom SMTP and email templates as outstanding. This audit did not inspect hosted SMTP configuration or send email. | Verify custom SMTP and the deployed confirmation/recovery code templates. Complete real registration, confirmation, resend and password recovery with a non-team mailbox before public release. Email is currently the only enabled sign-in method. |
| Blocker: unverified | The native protection config plugin still adds Family Controls, App Groups and four iOS extensions while their UI is hidden. Distribution entitlement grants and provisioning profiles were not inspected. | Verify distribution signing for the application and all retained extension bundle IDs, including Family Controls authorization. Hiding UI does not remove signing requirements. |
| High | `expo-doctor` passes 19/20 checks. `expo install --check` reports Expo 58.0.13 → ~58.0.14, dev-client 58.0.13 → ~58.0.14, router 58.0.22 → ~58.0.23, Jest 29.7.0 → ~30.5.2 and @types/jest 29.5.14 → 30.0.0. | Align packages with `npx expo install --fix`, then repeat validation and native build testing. No dependencies were changed by this task. |
| High: unverified | Existing deployment notes report a GitHub billing lock. This checkout has no Git remote, so the repository, current billing state and workflow run status could not be verified. | Configure/identify the remote repository and confirm a successful CI run. Do not assume the previously reported billing issue is resolved. |
| High: unverified | Android still bundles the Accessibility service and Usage Access permission. iOS and Android include camera/microphone declarations for user-initiated website media. Billing libraries remain bundled but are never initialized while Pro is disabled. | Review the final signed manifests, store data disclosures and permission declarations against the shipped free feature set. Native protection permissions must never be requested by hidden UI. |
| High: unverified | Production signed builds were not available. A paired iPhone 15 Pro on iOS 27.0.1 was detected, but `devicectl` reports Developer Mode disabled, preventing development installation/testing. | Complete the device matrix below and confirm backend monitoring, quotas, backups and recovery procedures before launch. |

## Backend and security evidence

Read-only requests to the configured Supabase Edge API returned:

- `GET /health`: HTTP 200, `status: ok`.
- `GET /ready`: HTTP 200, `status: ready`.
- `GET /v1/auth/providers`: HTTP 200, `emailPassword: true`, `oauth: []`.
- `GET /v1/me` without credentials: HTTP 401, `AUTH_REQUIRED`.

No hosted settings, accounts, secrets, migrations or deployments were changed. No emails were sent. Readiness is evidence of current table access, not proof that all production operations or email delivery work.

Source review and 23 passing backend tests verify token checks on private routes, user-token RLS access, owner-scoped deletion, revision conflicts, schema validation, bounded request bodies, shared rate limits, fixed OAuth callbacks/PKCE and redacted upstream errors. `verify_jwt = false` applies to the Edge platform wrapper because sign-in routes are public; private handlers explicitly authenticate with Supabase Auth. Real account export/deletion and live cross-account isolation were not exercised against production.

Private `.env` files are ignored. Tracked environment files are examples. The mobile configuration exposes public API/SDK configuration only; no `EXPO_PUBLIC_*SECRET*` or service-role references were found in mobile source. Refresh tokens stay in SecureStore; access tokens remain in memory. No backend API or database schema changes were needed for this release policy.

## Validation and device matrix

Final local verification: application lint and TypeScript checks passed; all 270 application tests across 37 suites passed. Backend lint/typecheck, all 23 backend tests, the Node build and the Deno Edge Function typecheck passed. `git diff --check` passed. Expo dependency diagnostics remain blocked only by the version mismatches listed above.

Automated coverage includes actual root guard declarations, complete root-route registration, post-authentication destinations, pending verification, recovery, hydration, existing guests, cached accounts, secure storage errors, late authentication/refresh responses after sign-out, immediate local revocation, free/Pro entitlement combinations, disabled billing SDK calls, empty native plans, cancelled reminders and backup preservation. Existing premium behavior tests explicitly enable the flag so the retained implementation remains tested.

| Scenario | Evidence / remaining validation |
| --- | --- |
| iOS development simulator cold launch | iPhone 18 Pro, iOS 27.0, existing development build: displayed the mandatory sign-in screen for an existing guest. Sign-in and registration layouts were inspected in Uzbek. Unconfigured social provider buttons were removed; the live backend enables email only. |
| Signed-out deep links and back navigation | Root guard tests deny browser, app settings, account and premium routes without an account. Interactive browser-link access remained at sign-in. Complete the remaining route, back-gesture and authenticated device matrix in signed builds. |
| First-run onboarding and registration | Automated decision/navigation tests pass. Real email delivery and complete first-run device flow remain unverified. |
| Recovery, offline restoration, sign-out and account deletion | Session and navigation tests cover access transitions. Verify interactively in signed iOS and Android builds with test accounts. |
| Premium UI absence and retained saved settings | Automated release-policy and backup tests pass. Inspect Home, app settings, statistics, permissions, help and account screens in English, Russian and Uzbek on both platforms. |
| Native cleanup on upgrade | Mocked bridge tests verify application of an empty native plan without deleting preferences. Verify on devices upgraded from a build with active protections; include revoked permissions and device reboot. |
| Android layouts and navigation | No Android SDK/ADB or running Android device was available. Full device validation remains required. |
| Physical devices and store builds | Not performed; the paired physical iPhone has Developer Mode disabled. Verify confirmation callbacks, keyboard/safe-area layouts, accessibility, restart/offline behavior and production environment values. |

The iOS smoke test exposed and resolved a navigation render loop: root navigation-state observation now lives in a separate child component, so navigation updates do not continually recreate protected-route guard maps.

A separate onboarding refactor modified/removed age/lifetime-projection files during validation. Its changes are preserved and owned by the other task. Whole-app lint and typechecking subsequently passed after those references were updated; the authentication/release tests are also independent of that refactor.

## Local verification commands

```sh
npm run lint
npm run typecheck
npm test
npm run backend:check
npm --prefix backend run build
npx --yes deno@2.9.6 check --config supabase/functions/focusup-api/deno.json supabase/functions/focusup-api/index.ts
npx expo install --check
npx expo-doctor
```

For versioned framework behavior, consult [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) and [Expo Router protected routes](https://docs.expo.dev/router/advanced/protected/). Backend deployment details remain in [production-deployment.md](production-deployment.md).
