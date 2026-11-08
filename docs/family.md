# Vaqtim Family

Free family controls inside Vaqtim: one parent manages several children, each with one supervised phone. iPhone and Android, in any mix. Off by default on both the app and the server.

## How it works

1. **Parent** (signed-in Vaqtim account): Settings → Vaqtim Family → reads what it does and does not do, agrees to the consent text, sets up the family (country: Uzbekistan only for now).
2. **Add child**: nickname and birth date only. The child gets no email or account.
3. **Pair**: the parent's phone shows an 8-character code (10 minutes, single use). On the child's phone: launch screen → "Connect to my parent" → code → supervision notice. The child's phone then shows a 6-digit confirmation code, which the parent types. Approval needs a sign-in from the last 10 minutes.
4. **Rules** (per child): blocked original apps, clean browsers (13 and over only), and downtime (bedtime, homework). Saved with a revision check, so two parent phones cannot overwrite each other.
5. **Child's phone** checks in on launch, when returning to the foreground, every 30 seconds while open, and on a content-free "family-refresh" push. It applies the rules and reports back. The parent sees **Setup needed**, **Waiting for device**, **Applied** or **Protection unavailable**.

## What the code does where

| Piece | File |
|---|---|
| Database (tables, functions, permissions) | `supabase/migrations/202611080001_family.sql` |
| API routes, shared by Fastify and the Edge Function | `backend/src/family.ts`, `backend/src/familySchemas.ts` |
| Rules logic (one resolver for native blocking, browsers and settings) | `src/services/family/resolver.ts`, `policy.ts` |
| Child phone sync, claim, release | `src/services/family/deviceSync.ts`, `src/store/familyStore.ts` |
| No analytics on child phones | `src/services/family/analyticsGate.ts`, `src/services/analytics/productAnalytics.ts` |
| Supervised browser navigation | `classifySocialBrowserNavigation(..., supervised)` in `src/services/social-browser/navigation.ts` |
| Downtime and under-13 browser lock | `src/features/family/browserAccess.tsx` |
| iOS child authorization | `requestChildAuthorization` in `modules/focusup-protection/ios/FocusUpProtectionModule.swift` |
| Screens | `src/app/family/*`, Settings row, launch-screen button |
| Text (uz, ru, en) | `src/translations/family.ts` |

## Rules that must keep holding

- Family rules only add restrictions. A child's own settings, a restored personal backup, or turning a switch off cannot weaken them (`familyAppSettings`, `applyFamilyToPlan`, and the checks in `appStore` setters).
- Family rules are never in the personal settings backup (`user_settings`).
- Reels, Shorts and For You stay blocked in supervised browsers. If the remote config pauses one of those blockers, the browser closes with an error instead of showing the feed.
- Under 13: no Instagram, YouTube or TikTok inside Vaqtim. The server also rejects such rules (`FAMILY_UNDER_13_BROWSING`).
- The original app stays blocked while its clean version is allowed.
- Supervised browsers never hand links to another browser or app. Sign-in pages are allowed only on their exact sign-in paths.
- An app counts as protected only when the phone really blocks it. On a supervised iPhone that needs the **child** Screen Time authorization; a personal (individual) one does not count.
- Child phones send no PostHog events or session replay. A fresh install with the family path offered waits until someone picks the personal path.
- A child phone cannot use "Clear Vaqtim data", sign in to a personal account, or take breaks.
- Removal, replacement and family deletion are confirmed by the phone before its rules are lifted ("released" → the phone tells the server → then clears). Offline phones show as "Being removed" until they check in.

## Switches

| Switch | Where | Now |
|---|---|---|
| `FAMILY_ENABLED` | `src/config/release.ts` | `false`: no Settings row, no "Connect to my parent" button |
| `FAMILY_ENROLLMENT_ENABLED` | Edge Function secret / backend env | `false` (default): no new families, children or pairings |
| `FAMILY_COUNTRIES` | Edge Function secret / backend env | `UZ` |

Phones that are already supervised keep syncing whatever the switches say, so rules, removal and release keep working.

## Before the pilot (owner decisions and approvals)

1. **Legal check**: have the consent text (`family.parent.consentBody` in `src/translations/family.ts`), retention and hosting (Supabase region) checked against Uzbekistan's personal-data law (lex.uz act 4396428), including any rule about where data on Uzbek citizens must be stored. Bump `FAMILY_CONSENT_VERSION` in `backend/src/family.ts` when the text changes.
2. **Database migration** (production change, needs your OK): `202611080001_family.sql` is additive only.
3. **Edge Function deploy** (needs your OK): after `npm run backend:check`, the command in `AGENTS.md` section 7. Existing routes are unchanged; `/v1/me/export` gains a `family` field.
4. **Native build**: the iOS module has a new function, so the next store build needs a new `ios.runtimeVersion` (and, to keep the platforms together, `android.runtimeVersion`). Not changed yet, so it does not interfere with the release in progress.
5. **Apple**: confirm the Family Controls distribution entitlement covers `.child` authorization (it is the same entitlement; Apple's review notes should mention the family feature). App Store age rating and privacy labels must mention the child audience.
6. **Google Play**: update the Accessibility declaration and demo video to show the family use, and check the Families policy and target-audience declaration.
7. **Real-device tests** (below), then set `FAMILY_ENABLED = true` in a pilot build and `FAMILY_ENROLLMENT_ENABLED=true` on the server.

## Testing

Automated: `npm test` (resolver, sync loop, navigation, analytics gate, routes), `npm run backend:check` (the migration in an in-memory Postgres; every route through both the Edge handler and Fastify: cross-family access, device privilege, expired and replayed codes, revocation, revision conflicts, removal, turning 18, export, deletion).

By hand, on real phones (simulators have no Screen Time):

- iPhone child in Family Sharing: "Give permission" asks for the parent's Apple ID; then pick each app in Apple's list; parent sees **Applied**.
- iPhone not in Family Sharing as a child: the phone shows the "not a child account" message and the parent sees **Protection unavailable**.
- Android child: Accessibility service on/off changes the parent's status on the next check-in. On Android 13+, sideloaded builds need "Allow restricted settings" first.
- Every parent/child platform pair: iPhone→iPhone, iPhone→Android, Android→iPhone, Android→Android.
- Downtime: start and end boundaries (an open video stops), overnight, a weekday not in the list, changing the phone's time zone, rebooting.
- Offline child phone: rules keep working; changes wait; removal shows "Being removed" until it reconnects.
- Small screen, light and dark mode, all three languages.

## Not in this version

Subscriptions, usage reports, location, message monitoring, break requests. Background check-ins: pushes are handled while Vaqtim is open; when it is closed, the next open applies the changes (iOS and Android may delay or drop silent pushes).
