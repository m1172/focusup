# Google Play: everything to fill in

Package: `com.m1172.focusup`. App name: **Vaqtim**. Paste the text below into Play Console. Check marks in the forms must match how the app really works; if the app changes, update these answers first.

## 1. Before the first upload

- **Account type.** Personal accounts created after 13 November 2023 must run a **closed test with at least 12 testers for 14 days in a row** before Production is unlocked. Start this early. Organisation accounts can skip it.
- **App signing.** Let Google manage the app signing key (Play App Signing). You create the upload key once on your Mac (see [local-release-build.md](../local-release-build.md)); Google keeps the app signing key.
- **First upload by hand.** Google requires the very first build to be uploaded in Play Console. After that, `npm run release` (or `npm run upload:android`) uploads new builds to the internal track as a draft.

## 2. Store listing

Default language: **English (United States)**. Add **Russian** and, if Play Console offers it in *Manage translations*, **Uzbek**.

### English

**App name** (30): `Vaqtim: Block Reels & Shorts`

**Short description** (80): `Instagram, YouTube and TikTok without the short-video feeds. Messages stay.`

**Full description:**

```
Vaqtim gives you social media without the endless scroll.

Open Instagram, YouTube and TikTok inside Vaqtim and the short-video feeds are gone. Reels, Shorts and the For You feed are always hidden, while everything you actually came for stays: messages, friends, profiles, posts and regular videos.

WHAT DISAPPEARS
• Instagram Reels
• YouTube Shorts
• The TikTok For You feed
• Endless short-video scrolling

WHAT STAYS
• Messages and friends
• Profiles and posts
• Regular YouTube videos and your subscriptions
• Videos people send you

SEE YOUR TIME
Vaqtim shows how much time short videos were taking from your day, and how much you get back.

PRIVATE BY DESIGN
• You sign in on Instagram's, Google's and TikTok's own pages. Your social media passwords never reach our servers.
• Delete your account and its data in the app at any time.

Vaqtim is free and available in English, Russian and Uzbek.

Instagram is a trademark of Meta Platforms, Inc., YouTube is a trademark of Google LLC and TikTok is a trademark of ByteDance Ltd. Vaqtim is not affiliated with, endorsed or sponsored by them.
```

### Russian

**Название** (30): `Vaqtim: без Reels и Shorts`

**Краткое описание** (80): `Instagram, YouTube и TikTok без лент коротких видео. Сообщения остаются.`

**Полное описание:**

```
Vaqtim — соцсети без бесконечной ленты.

Откройте Instagram, YouTube и TikTok внутри Vaqtim, и ленты коротких видео исчезнут. Reels, Shorts и лента «Рекомендации» в TikTok всегда скрыты, а всё, ради чего вы заходите, остаётся: сообщения, друзья, профили, посты и обычные видео.

ЧТО ИСЧЕЗАЕТ
• Instagram Reels
• YouTube Shorts
• Лента «Рекомендации» в TikTok
• Бесконечная прокрутка коротких видео

ЧТО ОСТАЁТСЯ
• Сообщения и друзья
• Профили и посты
• Обычные видео на YouTube и ваши подписки
• Видео, которые вам присылают

ВАШЕ ВРЕМЯ
Vaqtim показывает, сколько времени короткие видео отнимали у вас в день и сколько вы возвращаете.

КОНФИДЕНЦИАЛЬНОСТЬ
• Вы входите на страницах самих Instagram, Google и TikTok. Пароли от соцсетей не попадают на наши серверы.
• Аккаунт и его данные можно удалить в приложении в любой момент.

Vaqtim бесплатный, на русском, английском и узбекском языках.

Instagram — товарный знак Meta Platforms, Inc., YouTube — товарный знак Google LLC, TikTok — товарный знак ByteDance Ltd. Vaqtim не связан с ними и не одобрен ими.
```

### Uzbek

**Nomi** (30): `Vaqtim: Reels va Shorts’siz`

**Qisqa tavsif** (80): `Instagram, YouTube va TikTok qisqa video lentalarisiz. Xabarlar qoladi.`

**To‘liq tavsif:**

```
Vaqtim — cheksiz lentasiz ijtimoiy tarmoqlar.

Instagram, YouTube va TikTok’ni Vaqtim ichida oching — qisqa video lentalari yo‘qoladi. Reels, Shorts va TikTok’dagi «Siz uchun» lentasi doim yashirin, siz kirgan narsalar esa qoladi: xabarlar, do‘stlar, profillar, postlar va oddiy videolar.

NIMA YO‘QOLADI
• Instagram Reels
• YouTube Shorts
• TikTok’dagi «Siz uchun» lentasi
• Cheksiz qisqa video lentalari

NIMA QOLADI
• Xabarlar va do‘stlar
• Profillar va postlar
• Oddiy YouTube videolari va obunalaringiz
• Sizga yuborilgan videolar

VAQTINGIZ
Vaqtim qisqa videolar kuningizdan qancha vaqt olganini va qanchasini qaytarib olganingizni ko‘rsatadi.

MAXFIYLIK
• Siz Instagram, Google va TikTok’ning o‘z sahifalarida kirasiz. Ijtimoiy tarmoq parollaringiz serverlarimizga yetib bormaydi.
• Hisobingiz va ma’lumotlarini ilovada istalgan vaqtda o‘chirasiz.

Vaqtim bepul, o‘zbek, rus va ingliz tillarida.

Instagram — Meta Platforms, Inc., YouTube — Google LLC, TikTok — ByteDance Ltd. savdo belgilari. Vaqtim ular bilan bog‘liq emas va ular tomonidan ma’qullanmagan.
```

### Graphics

| Asset | Size | Source |
|---|---|---|
| App icon | 512 × 512 PNG | `assets/icon.png` resized |
| Feature graphic | 1024 × 500 PNG/JPG | To make (logo + "Instagram, YouTube and TikTok without the short-video feeds") |
| Phone screenshots | 2–8, 9:16, at least 1080 px wide | See the screenshot plan in [README.md](README.md) |

**Category:** Productivity. **Contact email:** vaqtim.app@gmail.com (switch to support@vaqtim.com once it forwards mail). **Website:** https://vaqtim.pages.dev. **Privacy policy:** https://vaqtim.pages.dev/privacy/ (switch to vaqtim.com once the domain is connected)

## 3. App content (Policy → App content)

### Privacy policy
`https://vaqtim.pages.dev/privacy/`

### Ads
**No**, the app does not contain ads.

### App access
**All or some functionality is restricted** (sign-in is required). Give reviewers a test account: an email and password for a Vaqtim account you create for review, plus: *"Sign in with email. Instagram content needs an Instagram account; YouTube works without signing in."*

### Content rating (IARC questionnaire)
- Category: **All other app types** (Productivity/Utility).
- Violence, sexuality, language, controlled substances, gambling: **No** for the app itself.
- **Users can interact or exchange content: Yes.** Inside the app people use their Instagram and YouTube accounts, which include messaging and user posts.
- **Shares user location: No. Allows purchases of digital goods: No** (update when paid plans launch).
- Expect a teen-level rating because of user interaction.

### Target audience and content
- Target age groups: **16–17 and 18 and over.** Leave out under-13 and 13–15 for now. Including children brings in the Families policy and stricter children's data rules.
- Appeals to children: **No.**

### Data safety

Answer **Yes** to "Does your app collect or share any of the required user data types?" and **Yes** to "Is all of the user data collected by your app encrypted in transit?". Users can request deletion: **Yes**, with the URL `https://vaqtim.pages.dev/delete-account/`.

| Data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Personal info → Email address | Yes | No | Required | Account management, app functionality |
| Personal info → Name | Yes | No | Optional | Account management, app functionality |
| Personal info → User IDs | Yes | No | Required | Account management, analytics |
| Messages → Other in-app messages (support chat) | Yes | No | Optional | Developer communications, customer support |
| App activity → App interactions | Yes | No | Optional (can be turned off in Settings → Privacy) | Analytics |
| App activity → Other actions (weekly app usage minutes) | Yes | No | Optional | Analytics, app functionality |
| App info and performance → Crash logs | Yes | No | Optional | Analytics |
| App info and performance → Diagnostics | Yes | No | Optional | Analytics |
| Device or other IDs | Yes | No | Required | Analytics, app functionality (push notification token) |

Not collected: location, financial info, health, photos and videos, audio, files, calendar, contacts, web browsing history. Data sent to service providers that process it for us (Supabase, PostHog, Expo, Telegram support relay) counts as **not shared** under Google's definitions.

When paid plans launch, add **Financial info → Purchase history** (purchases through Google Play).

### Sensitive permissions

> **Not in the current release.** Android real-app locking is switched off (`ANDROID_APP_BLOCKING = false` in `src/config/release.ts`, `withAndroidAccessibility` `{ "enabled": false }` in app.json), so the build has no Accessibility service and Play does not ask for the declaration below. Keep it for when the feature returns.

**Accessibility API declaration** (Play Console asks when the build includes an Accessibility service):

- Is the app's core functionality based on Accessibility? **No.** It is one optional feature.
- Description to paste:

```
Vaqtim uses the AccessibilityService API only for an optional feature that the user turns on: when the user adds an app on the Protect tab and allows it, Vaqtim detects when the original Instagram, YouTube or TikTok app comes to the foreground and shows a Vaqtim screen that opens the filtered version inside Vaqtim instead.

The service only listens to TYPE_WINDOW_STATE_CHANGED events to read the package name of the foreground app; canRetrieveWindowContent is false, so it cannot read screen content. It does not read, store or transmit messages, passwords or typed text, and no accessibility data leaves the device. Before the user is sent to Android settings, Vaqtim shows an in-app disclosure explaining this. The user can turn the feature off at any time in Vaqtim, and the service off in Android settings.
```

- **Video** (Google asks for a short screen recording, uploaded to YouTube as unlisted). Record on an Android phone:
  1. Open Vaqtim → Protect tab → tap Instagram to add it.
  2. Show the in-app disclosure dialog, then tap continue.
  3. Show Android settings → Accessibility → turn on "Vaqtim protection".
  4. Return to Vaqtim; Instagram shows as locked.
  5. Open the real Instagram app; the Vaqtim screen appears and opens the clean version.
  6. Turn it off again: drag Instagram out on the Protect tab.

**Usage access (`PACKAGE_USAGE_STATS`)**: used during onboarding to show how much time the user spent on Instagram, YouTube and TikTok, after the user grants it in Android settings. If Play Console asks, explain exactly that.

**Package visibility**: the app only declares the specific social apps it works with (`<queries>`), so no QUERY_ALL_PACKAGES declaration is needed.

**Camera and microphone**: requested only when the user chooses to take a photo or record in the social website (for example posting a story).

### Data deletion
- In app: Settings → Account → Delete account.
- Web URL: `https://vaqtim.pages.dev/delete-account/`

### Government, financial, health, news apps
Not applicable.

## 4. Testing and release

1. Internal testing: upload the first `.aab` by hand, add your own Gmail as a tester, install from the opt-in link.
2. Closed testing (personal accounts): add at least 12 testers and keep them opted in for 14 days. Ask them to actually open the app on those days.
3. Production: apply for production access in Play Console, then roll out to 20% first and raise it if crash reports stay clean.
