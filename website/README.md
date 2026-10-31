# Vaqtim website

React website for vaqtim.com, built with Next.js 16 (App Router, static export), Motion for animation and Lenis for smooth scrolling. It is a separate project from the mobile app, with its own `package.json`.

| Path | Page |
| --- | --- |
| `/` | Picks `/uz/`, `/ru/` or `/en/` from the browser language |
| `/{lang}/` | Home |
| `/{lang}/support/` | Support |
| `/{lang}/privacy/` | Privacy Policy (required by App Store and Google Play) |
| `/{lang}/terms/` | Terms of Use |
| `/{lang}/delete-account/` | Account deletion (Google Play requires a web URL) |

Short links `/privacy/`, `/terms/`, `/support/` and `/delete-account/` redirect to the Uzbek pages on Cloudflare Pages (`public/_redirects`).

**`/app`** is the link to share: iPhone and iPad open the App Store, Android opens Google Play, and computers land on the home page's download section (`#download`). It is a Cloudflare Pages Function (`functions/app/index.ts`), so it only works on Cloudflare (or `npx wrangler pages dev out`), not with `npm run preview`.

## Where things are

- `src/content/site.ts`: all page text in Uzbek, Russian and English, plus the support email and store links.
- `src/content/legal.ts`: Privacy Policy and Terms.
- `app/[lang]/`: the pages. `app/globals.css`: design tokens (same colours as the app) and styles.
- `src/components/`: header, footer, the animated phone (`PhoneDemo`), scroll reveals and the other animations.

Animations only move `transform`/`opacity`, run once when a section comes into view, and switch off for visitors who turned on "Reduce motion".

## Develop and build

```bash
cd website
npm install
npm run dev        # http://localhost:4173 with live reload
npm run build      # static site in website/out
npm run preview    # serve website/out on http://localhost:4173
npm run typecheck
```

Store links live in `src/content/stores.ts` (App Store `id6829294178`, Google Play `com.m1172.focusup`). The buttons and `/app` both use them. To show "coming soon" instead, build with an empty value, for example `NEXT_PUBLIC_APP_STORE_URL= npm run build`.

Then replace the button icons with Apple's and Google's official store badges, as their brand rules require.

## Go live

1. **Buy the domain:** `vaqtim.com` (and `vaqtim.app`) at Cloudflare Registrar or Namecheap. `vaqtim.uz` is already taken.
2. **Host on Cloudflare Pages (free):** connect the repository, set root directory `website`, build command `npm run build` and output directory `out`. Add `vaqtim.com` and `www.vaqtim.com` as custom domains.
3. **Email:** turn on Cloudflare Email Routing and forward `support@vaqtim.com` to your inbox.
4. **Point the app at the site** in `.env` and the EAS production environment:
   - `EXPO_PUBLIC_PRIVACY_POLICY_URL=https://vaqtim.com/privacy/`
   - `EXPO_PUBLIC_TERMS_URL=https://vaqtim.com/terms/`
   - `EXPO_PUBLIC_SUPPORT_EMAIL=support@vaqtim.com`
5. **Store listings:** the same Privacy Policy URL in App Store Connect and Google Play, and `https://vaqtim.com/delete-account/` as Google Play's account deletion URL.
6. **Sign-in prompt:** iOS shows "wants to use vrmfrhvzvjrktiosptdp.supabase.co to Sign In". A Supabase custom domain such as `auth.vaqtim.com` (paid Supabase add-on) shows your own domain instead.

## Before publishing the legal pages

`src/content/legal.ts` was drafted from how the app works in October 2026, not by a lawyer:

- Add the legal name and address of the company or person running Vaqtim.
- Have a lawyer check it, especially Uzbekistan's personal data law (local storage of citizens' data), and children's privacy rules if you ever target users under 16.
- Keep it in sync with the app: update it before adding a new data flow or provider.
