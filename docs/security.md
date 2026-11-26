# Security release preparation — 10 November 2026

**Update, 25 November 2026:** at the owner's decision, migrations `202611090002` (billing) and `202611090003` (security) were applied to production and `focusup-api` was deployed from commit `89bf676`, without the staging test below. `EDGE_TRUSTED_CLIENT_IP_HEADER` stays off. The previous API was version 13, built from commit `eb4a18c`; redeploy that commit to roll back the code. Production has not been load-tested. The native and device gates below still apply to the 1.1.0 store build.

These changes were first prepared locally on 10 November.

## Implemented boundaries

Telegram email uniqueness no longer proves identity. Login resolves the trusted Telegram mapping after creation/collision, checks the link user and session user, and rejects conflicting ownership. Login results carry random identifiers consumed atomically by a server-only SQL function. Deploy the additive 202611090003 migration before the backend. In-flight older Telegram results must restart login.

Account deletion requires verified authentication within ten minutes. Token refresh does not satisfy it. Reauthentication and cookie capability messages are translated into Uzbek, Russian and English.

Android cookies use WebKit's attribute-preserving interface and asynchronous restore acknowledgements. Site-data deletion waits for WebKit completion and clears Instagram cookies across paths. Capability checks require both cookie metadata and complete site deletion. Relative Max-Age is dropped only when an absolute expiry is present; otherwise restoration is refused. Native unit tests cover attribute retention, lifetime preservation and invalid snapshot rejection. Builds without that capability cannot switch accounts. Saved sessions now use version 2, device-only secure storage and native account IDs. Legacy snapshots are not restored; sign into Instagram again to create new snapshots. Website account names cannot select another account's credentials. Website messages are origin checked and bounded to 16 KiB. Older bridge origin information is not sufficient on its own, so native identity checks are also required.

Family startup checks secure credentials before allowing personal startup. Missing ordinary storage recovers a conservative supervised state; network failure keeps it supervised. Full device erasure/uninstallation and compromised operating systems are outside this recovery guarantee.

## Required staging gate

EDGE_TRUSTED_CLIENT_IP_HEADER is disabled by default. Enable cf-connecting-ip ONLY after testing that the managed gateway overwrites arbitrary caller-supplied copies, through every supported domain. Test simultaneous unrelated callers, forwarded-header forgery, absent/malformed headers, rotating invalid device secrets, and normal sync under abuse. Do not deploy this rate-limit change before that gate passes. There is no verified ingress identity in this local environment.

Low global authentication/private quotas are removed. Existing verified-user quotas remain. Optional trusted-ingress admission runs before authentication. Invalid device-secret quota storage is bounded to 256 shards per route instead of growing per random secret. These shards are a bounded fallback, not proof against distributed denial of service; the ingress gate is mandatory. Verified device/pairing identities have separate quotas resolved by a server-only lookup; rotating unknown secrets use only the bounded invalid-device shards.

## Native and device gates

No physical-device tests have been performed. Verify HttpOnly remains invisible to document.cookie, Secure/SameSite/path/expiry round trips, session cookies retain their lifetime, switching cannot race a stale account message, and unsupported WebViews explain the limitation. Validate cookie clearing for domain/path variants before release. Android runtime is 1.0.0-secure-cookies; native changes require a new build. Confirm iPhone Family blocking, Android enforcement, cache loss, offline startup, and later recovery. Do not send child analytics.

## Dependency exceptions

Compatible npm audit fixes removed the app's high-severity Zod advisory and backend fast-uri advisories. Remaining low/moderate advisories affect glob/minimatch/deepmerge in Expo/Jest/ESLint tooling. Temporary exception through 9 December 2026: retain SDK 58 and the compatible test toolchain rather than accepting audit's proposed major downgrades. Re-run audits before release; inspect runtime reachability and fail CI for high/critical findings. Reassess these exceptions at expiry. This is not an exception for a reachable production vulnerability.

CI now audits all three dependency trees, validates the website, and runs redacted Gitleaks scanning. Local Gitleaks scanned 26 commits, added lines in the tracked working diff, and new untracked source files. One historical finding was a public PostHog project token in the example environment; the exact historical fingerprint is allowlisted, and the current example now leaves that value blank. PostHog documents this key as public at https://posthog.com/docs/feature-flags/installation. No broad secret-rule exclusions were added. Review findings without pasting secret values; rotate exposed credentials through the owner's approved account workflow.

## Deployment and recovery

The owner must approve migrations/deployments and store builds/uploads separately. Never modify Apple Business settings. Preserve the previous backend artifact and database backups. Roll back application code if needed while retaining the additive redemption table; never restore replayable login behavior as a workaround. If Telegram identity conflicts occur, investigate trusted identity records without automatically merging accounts. No evidence of an actual compromise was established by this source review.

## Local validation results

App lint/typecheck, 71 Jest suites (571 tests), backend lint/typecheck (51 tests), Edge Deno typecheck, and the website typecheck/build passed. The Android native module compiled and its three cookie snapshot unit tests passed with Android Studio's bundled JDK and the installed SDK. These are local compile/unit checks, not store builds, uploads or physical-device acceptance. Device UI validation and trusted-ingress staging verification remain required before rollout.
