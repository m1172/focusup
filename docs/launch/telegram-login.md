# Telegram login on the Vaqtim website domain

Telegram tells people which website they signed in to ("You have successfully logged in on …"). With Supabase's
hosted Telegram login that is the raw Supabase address. These steps move it to the Vaqtim website,
`vaqtim.pages.dev` (and later `vaqtim.com`, once that domain is connected to the same Pages project).
The app itself does not change and needs no new build.

How it works: the app opens Telegram's own login page → Telegram sends the user back to
`https://vaqtim.pages.dev/telegram/callback` (a Pages Function, `website/functions/telegram/callback.ts`) →
the function passes that to the Edge API, which checks Telegram's signed answer and sends the app a one-time
code → the app trades the code for a Vaqtim session. Existing Telegram accounts are kept (matched by
Telegram user ID). Only `/telegram/callback` runs code; the rest of the website stays static.

Do the steps in this order, so Telegram login keeps working the whole time.

## 1. Database

Apply the new migration `supabase/migrations/202610300001_telegram_login.sql`
(`npx supabase db push`, or paste it into the Supabase SQL editor).

## 2. Website

```bash
cd website
npm run deploy
```

`wrangler pages deploy` picks up the `functions/` folder automatically. Check:
`https://vaqtim.pages.dev/telegram/callback` shows "Sign-in could not be completed…" (expected without a login).

## 3. BotFather

In @BotFather → the login bot (`@focusup_login_bot`) → its login (OAuth) settings, add the allowed redirect URL
`https://vaqtim.pages.dev/telegram/callback`. Keep the old Supabase callback until step 4 is live.

## 4. Edge function secrets, then redeploy

Set these on the `focusup-api` function (Supabase dashboard → Edge Functions → Secrets, or
`npx supabase secrets set`). Never paste them into chat or commit them.

| Secret | Value |
| --- | --- |
| `TELEGRAM_LOGIN_CLIENT_ID` | The bot's numeric client ID (same as `TELEGRAM_CLIENT_ID` in `backend/.env`) |
| `TELEGRAM_LOGIN_CLIENT_SECRET` | The bot's client secret (same as `TELEGRAM_CLIENT_SECRET`) |
| `TELEGRAM_LOGIN_ORIGIN` | `https://vaqtim.pages.dev` |
| `TELEGRAM_LOGIN_KEY` | 48+ random characters, e.g. `openssl rand -base64 48` |

Then redeploy: `npx supabase functions deploy focusup-api`. All four must be set; until then Telegram keeps using
the Supabase-hosted login.

## 5. Test on a phone

Sign in with Telegram. The Telegram message should now name `vaqtim.pages.dev`. Sign in again with the same
Telegram account and check it is the same Vaqtim account (same settings). Once it works, the old Supabase
callback URL can be removed from BotFather.

## Moving to vaqtim.com later

Connect vaqtim.com to the same Pages project, add `https://vaqtim.com/telegram/callback` in BotFather, then set
`TELEGRAM_LOGIN_ORIGIN=https://vaqtim.com` and redeploy the function. Accounts are matched by Telegram ID, so
nobody loses their account.

New accounts get an internal address `tg-<telegram id>@<website host>`. No email is ever sent to it.
