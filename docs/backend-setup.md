# FocusUp backend

The backend is an independent Node.js 22 / TypeScript / Fastify API in `backend/`. Supabase provides PostgreSQL and Auth. Fastify supplies request validation, business rules, bounded settings backups and account-management endpoints without adding server dependencies to the Expo bundle. There is no separate database, ORM, Redis service or file-storage requirement for this MVP.

Supported authentication paths are email/password, Google, Apple and Telegram. Provider credentials must be configured before social sign-in works. The account screen is available at Settings → Your account. Mobile services in `src/services/backend/` handle secure refresh-token storage, serialized refresh, native Apple sign-in on iOS, Google/Telegram browser OAuth, callback validation, explicit backup/restore and account export/deletion. No data uploads or automatic restores run on app startup.

## Start with hosted Supabase Free

1. Create a Supabase project. Pick a region suitable for your users.
2. In the SQL Editor, run `supabase/migrations/202610170001_initial_backend.sql` once. Alternatively, use the Supabase CLI from the repository root:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

3. Copy the backend environment template and install the independent server packages:

   ```sh
   cp backend/.env.example backend/.env
   npm --prefix backend ci
   ```

4. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in `backend/.env`. The publishable key can also be the legacy anon key; the secret key can be the legacy service-role key. The secret is used only for account deletion and the explicit Telegram provisioning command. Never put it in an `EXPO_PUBLIC_` variable or mobile build.
5. In Supabase Auth, enable email confirmation, set the minimum password length to 12, and configure the Site URL and permitted redirect URLs. Set `AUTH_REDIRECT_URL` to your real callback destination. For a mobile development build, use `focusup://auth/callback`; its Expo Router screen is implemented. For web, use your exact origin plus `/auth/callback`. The backend currently uses one fixed callback per deployment, so use separate environment configuration for native and web testing. Add that exact destination to Supabase's redirect allowlist. Do not ship a callback pointing to localhost.
6. Set `EXPO_PUBLIC_API_URL` in the root `.env` to the backend origin, restart Metro, then build a fresh development client. The account flow adds Expo SecureStore, Crypto, WebBrowser, AppleAuthentication, FileSystem and Sharing; native configuration is in `app.json`. Run `npx eas-cli build --profile development --platform all` for EAS builds. Native social callback flows require the configured `focusup` scheme.
7. Start the server:

   ```sh
   npm run backend:dev
   curl http://localhost:3000/health
   curl http://localhost:3000/ready
   ```

`/health` checks the process; `/ready` checks that Supabase's Data API can reach the migrated table. A health response alone does not confirm database setup. An unavailable or paused Supabase project will fail readiness. Use the dashboard SQL Editor if the local CLI or Docker is unavailable.

The API defaults to port 3000 and listens on all interfaces for phone testing. An Android emulator normally reaches the host at `http://10.0.2.2:3000`; a physical phone needs the computer's LAN address on the same network. The client requires an explicit `allowInsecureHttp: true` for HTTP development. Production traffic must use HTTPS.

## Authentication providers

### Email and password

Registration requires at least 12 characters. `POST /v1/auth/sign-up` returns `{ session: null, confirmationRequired: true }` when confirmation is enabled. Confirm the email, then sign in. The API never returns signup user details when there is no session.

The mobile screens use **email verification codes**. In Supabase Auth → Email Templates, copy `supabase/templates/confirmation.html` into Confirm signup and `supabase/templates/recovery.html` into Reset password. Both include `{{ .Token }}`. Keep the same code in any translated template. The local Supabase config already points to these files. Hosted dashboard templates must be configured separately; running a database migration does not change them.

For signup, enter the received code in the app. `/v1/auth/verify-code` verifies it with type `signup`. The screen can resend confirmation if needed. Password recovery requests a code through `/v1/auth/forgot-password`, verifies it with type `recovery`, then presents a new-password screen. The recovery flag is persisted with the refresh token until the password has been updated successfully. The token-hash `/v1/auth/verify` endpoint remains available for other clients; the mobile callback accepts PKCE OAuth codes only and never accepts arbitrary session tokens from a deep link.

Configure production SMTP before launching email authentication publicly; Supabase's built-in email service has delivery restrictions and is intended for testing. See [Supabase password auth](https://supabase.com/docs/guides/auth/passwords), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

### Google

Create a Google OAuth client in Google Cloud and configure the Google provider in Supabase Auth. Register the exact Supabase callback shown in that provider's dashboard, usually `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`, in Google's authorized redirect URIs. Use `openid`, email and profile scopes. Add native client IDs in Supabase if using native Google tokens.

After setup, include `google` in `AUTH_OAUTH_PROVIDERS`. The backend supports browser OAuth with PKCE and native Google ID-token exchange. See [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

### Apple

Enable Sign in with Apple for the app's identifier `com.m1172.focusup` in your Apple developer account. For browser OAuth, configure a Services ID, signing key/client secret and Supabase callback in Apple's developer portal, then configure the Apple provider in Supabase. Put the Services ID first in Supabase's client-ID list for web OAuth; include the app's bundle ID for native tokens. Maintain the Apple client secret according to its expiry.

After setup, include `apple` in `AUTH_OAUTH_PROVIDERS`. The backend supports browser OAuth with PKCE and native Apple ID tokens with a nonce. On iOS, the account screen uses the official native Apple button when supported, with a fresh nonce; Android/web use browser OAuth. See [Supabase Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple).

### Telegram

Use Telegram's current **OIDC login**, which Supabase can handle as a custom provider. This avoids a separate custom JWT issuer, synthetic email addresses and a password-based Telegram bridge. Telegram users may have `email: null`; the API and mobile types support this.

1. Create/select the application's bot in BotFather. In its Login Widget settings, get the OIDC **Client ID and Client Secret**. The client secret is distinct from the bot API token.
2. In Supabase Auth Providers, create an OIDC provider with identifier `custom:telegram`, issuer `https://oauth.telegram.org`, your BotFather credentials and scopes `openid` and `profile`. Enable **email optional**, PKCE and nonce validation. Telegram does not supply a separate UserInfo endpoint; use the claims in its ID token through OIDC discovery, rather than inventing a UserInfo URL.
3. Copy the **exact callback URL displayed by Supabase for this custom provider** into BotFather's Allowed URLs. Custom provider callbacks may differ from built-in provider callbacks.
4. Enable the provider and include `telegram` in `AUTH_OAUTH_PROVIDERS`.

An explicit provisioning command can create/update this configuration. Put `TELEGRAM_CLIENT_ID` and `TELEGRAM_CLIENT_SECRET` in `backend/.env` and run:

```sh
npm --prefix backend run auth:telegram
```

This command changes the connected project's Telegram provider. It does not run on API startup. Register the displayed dashboard callback in BotFather afterward. It does not request phone numbers, permission to message users, or bot access.

Supabase documents up to three custom providers on Free, so Telegram fits without a paid auth broker. Real consent/callback compatibility still needs testing against your configured project and bot. References: [Telegram Login](https://core.telegram.org/bots/telegram-login), [Supabase custom providers](https://supabase.com/docs/guides/auth/custom-oauth-providers).

### Mobile OAuth flow

Set `AUTH_OAUTH_PROVIDERS=google,apple,telegram` only after those providers are configured, plus a fixed `AUTH_REDIRECT_URL`. `/v1/auth/providers` reports the enabled methods.

1. Generate a fresh cryptographically random PKCE verifier on the device (43–128 URL-safe characters). Keep it for this login attempt only. Compute the base64url SHA-256 challenge.
2. Call `startOAuth(provider, codeChallenge)` and open the returned URL in the system authentication browser.
3. Consume the redirect through an Expo Router callback screen. Associate it with the pending sign-in attempt; reject unexpected callbacks. Do not accept arbitrary callback URLs or tokens from an untrusted deep link.
4. Extract `code` and call `exchangeOAuth(code, originalCodeVerifier)`. Supabase verifies the PKCE binding; a code without the original verifier cannot complete login. Clear the pending verifier after completion/cancellation. The verifier stays on the device until exchange.
5. Keep access tokens in memory and refresh tokens in an appropriate secure mobile store. Serialize refresh attempts, replace rotated refresh tokens, and clear tokens after sign-out/deletion. This API client deliberately supplies no persistent storage or automatic retries.

For native Apple/Google, use `signInWithIdToken(provider, idToken, rawNonce)` instead. Generate a new nonce per attempt and pass the provider's required form when obtaining the ID token; Supabase validates it against the supplied raw nonce. Follow the provider's SDK nonce rules.

The implemented native flow uses `WebBrowser.openAuthSessionAsync`; web uses a full-page redirect with only the short-lived PKCE verifier in session storage. Native refresh tokens use Expo SecureStore; access tokens stay in memory. Web account sessions are in memory and end on page reload. OAuth callback delivery is deduplicated so Android router and browser completion cannot redeem the same code twice. A custom-scheme callback needs a development build rather than an Expo Go callback assumption.

## API

All bodies and responses are JSON except successful 204 responses. Private endpoints require `Authorization: Bearer <Supabase access token>`. Identity always comes from Supabase Auth verification, never a supplied user ID.

| Method | Path | Body / behavior |
| --- | --- | --- |
| GET | `/health`, `/ready` | Process / database readiness |
| GET | `/v1/auth/providers` | Enabled sign-in methods |
| POST | `/v1/auth/sign-up` | `email`, `password`, optional `captchaToken` |
| POST | `/v1/auth/sign-in` | `email`, `password`, optional `captchaToken` |
| POST | `/v1/auth/refresh` | `refreshToken`; returns rotated session |
| POST | `/v1/auth/verify` | `tokenHash`, `type` (`email` or `recovery`) |
| POST | `/v1/auth/verify-code` | `email`, `token` (6–10 digits), `type` (`signup` or `recovery`) |
| POST | `/v1/auth/resend-confirmation` | `email`, optional `captchaToken`; generic 202 response |
| POST | `/v1/auth/forgot-password` | `email`, optional `captchaToken`; generic 202 response |
| POST | `/v1/auth/oauth/start` | `provider`, `codeChallenge`; fixed-callback authorize URL |
| POST | `/v1/auth/oauth/exchange` | `code`, `codeVerifier`; returns session |
| POST | `/v1/auth/id-token` | `provider` (`apple` or `google`), `idToken`, `nonce` |
| POST | `/v1/auth/sign-out` | Private; revokes refresh sessions globally; 204 |
| PATCH | `/v1/auth/password` | Private; `password`; 204 |
| GET | `/v1/me` | Private; account and profile |
| PUT | `/v1/me/profile` | Private; `displayName` (max 80 characters) |
| GET | `/v1/me/settings` | Private; backup or `{ revision: 0, payload: null, updatedAt: null }` |
| PUT | `/v1/me/settings` | Private; `expectedRevision`, `payload` |
| DELETE | `/v1/me/settings` | Private; `expectedRevision`; retains a revision tombstone |
| GET | `/v1/me/export` | Private; account/profile/settings export |
| DELETE | `/v1/me` | Private; deletes Supabase account and cascades app data; 204 |
| GET | `/v1/blocker-config` | Public; data-only config compatible with existing blocker client |

Sessions have `{ accessToken, refreshToken, expiresAt, user: { id, email } }`. Error responses have `{ error: { code, message, fields? }, requestId }`. Handle 400 validation, 401 sign-in required, 409 backup conflict, 429 throttling and 503 upstream unavailability. There is no endpoint to grant Pro; RevenueCat remains authoritative.

## Settings and privacy

`captureSettingsBackup()` builds the supported version-1 payload from the current stores: language, theme, app/filter preferences, schedules, goals/reminder choices, launch destination and sleep plan. Save after an explicit backup choice:

```ts
const api = createBackendClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL!,
  getAccessToken: () => currentSession?.accessToken ?? null,
});
const cloud = await api.getSettings();
const saved = await api.saveSettings(cloud.revision, captureSettingsBackup());
```

This low-level snippet assumes a caller manages `currentSession`; the account screens use the shared `accountApi()` and secure session manager instead. The API does not silently retry writes or resolve conflicts. A 409 requires reading the new revision and asking the user which settings to keep. Avoid blindly uploading an old local snapshot with a newly fetched revision.

Backups are bounded to a 64 KiB request and at most 50 schedules. Unknown fields, malformed times, unsupported app IDs and duplicate schedule IDs are rejected. SQL provides a second payload-size bound. A transactional compare-and-swap prevents lost updates, including on the first write. Deleting a backup preserves its revision so a stale device cannot immediately recreate it.

Only profile and settings data are backed up. Browsing history, social cookies/passwords/messages, measured usage, age/onboarding answers, raw analytics, strict/temporary sessions, native permissions/selections, notification IDs and purchase entitlements remain outside these endpoints. Protection continues locally without a network connection. The restore UI rejects an active strict session or strict routine, preserves native selections/permissions, temporary sessions and purchase state, and reconciles device protection after applying preferences. Reminder flags are disabled if notification permission is absent; the restore action never requests permission. Native apply failures roll back preferences and attempt to reapply the previous protection plan. Invalid cloud payloads are rejected before store updates.

The privacy screen clears local data and secure account/pending-login storage. Cloud deletion is separate in Your account: deleting a backup leaves local settings intact; deleting an account requires typing DELETE and confirming the action. Sign-out clears local tokens even when the server cannot be reached and reports when other refresh sessions could not be revoked. Deleting the Supabase account does not cancel an App Store/Play subscription or delete RevenueCat history. Global sign-out revokes refresh tokens; already-issued JWTs can remain valid until expiry under Supabase's session model.

The public blocker config initially has empty platform overrides, preserving the app's tested bundled rules. Set `EXPO_PUBLIC_BLOCKER_CONFIG_URL=https://YOUR_API/v1/blocker-config` to connect the existing client. Only ship reviewed data-only overrides; no client config-write endpoint exists.

## Deployment and checks

Build and run the independent backend:

```sh
npm --prefix backend run build
npm --prefix backend start
# Or build the container from backend/:
docker build -t focusup-backend backend
docker run --env-file backend/.env -e NODE_ENV=production -p 3000:3000 focusup-backend
```

Use a Node/container host with HTTPS and supply environment variables through its secret settings. Supabase hosts Auth/database; it does **not** host this long-running Node server. Node hosting is a separate cost/plan choice. Allowlist exact web origins with `CORS_ORIGINS`; native apps do not need CORS. Set `TRUST_PROXY` only to your hosting proxy's trusted IP/CIDR so rate limiting uses the correct client address. The in-memory limiter is for one instance; configure shared rate-limit storage when adding multiple instances. Before enabling Supabase CAPTCHA, connect a challenge UI and pass its `captchaToken`; the API accepts tokens but the current account form has no CAPTCHA widget. Keep Supabase and API signup rate limits enabled.

```sh
npm run backend:check
npm --prefix backend run build
npm run typecheck
npm run lint
npm test
```

Backend tests cover auth guards, OAuth URL/PKCE forwarding, credential isolation, validation, rate/body limits and database behavior. The migration test runs real PostgreSQL in PGlite with a small Supabase-auth fixture; it checks RLS, stale revisions, direct-write denial, tombstones, payload limits and account cascades. Additional mobile tests cover refresh races, sign-out during initialization/refresh, corrupt secure records, PKCE callback validation/deduplication/expiry, strict restore guards and native rollback. Automated tests do not validate live Supabase/provider credentials or native browser consent screens. To run a full local Supabase stack, install Docker and a compatible CLI, run `npx supabase start`, and apply migrations with `npx supabase db reset` only against the disposable local database.

As checked on 2026-10-17, [Supabase Free](https://supabase.com/pricing) includes a 500 MB database, 50,000 monthly active users, 5 GB egress and 1 GB storage; inactive projects can pause after one week. It is a reasonable MVP starting point for small settings snapshots. Monitor actual database size and bandwidth, keep independent backups, and revisit paid hosting/backups before relying on production availability. Free does not include automatic database backups.
