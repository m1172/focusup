# Google Play Console, screen by screen

Follow this in order. Every field you will see is listed with exactly what to enter. Long texts (descriptions, declarations) are in [google-play.md](google-play.md); images are in [`store/google-play/`](../../store/google-play/).

Until vaqtim.com is bought, use these links everywhere below:

| Link | Value |
|---|---|
| Website | `https://vaqtim.pages.dev` |
| Privacy policy | `https://vaqtim.pages.dev/privacy/` |
| Delete account | `https://vaqtim.pages.dev/delete-account/` |
| Support email | your own Gmail for now (later `support@vaqtim.com`) |

When vaqtim.com is live, replace `vaqtim.pages.dev` with `vaqtim.com` in Store settings, Privacy policy and Data safety.

---

## Screen 1: Create app

**Home → Create app**

| Field | Enter |
|---|---|
| App name | `Vaqtim: Block Reels & Shorts` |
| Package name | `com.m1172.focusup` (must match the build; can never be changed) |
| Default language | English (United States) – en-US |
| App or game | App |
| Free or paid | Free (can't be changed to paid later; paid plans would be in-app subscriptions, which is fine) |
| Declarations | Tick all: Developer Program Policies, Play App Signing terms, US export laws |

Click **Create app**.

---

## Screen 2: Dashboard → "Set up your app"

The Dashboard shows a list of tasks. Do them in this order. Each one opens a form; click **Save** at the bottom of every form.

### 2.1 Set privacy policy
**Policy → App content → Privacy policy**
- Privacy policy URL: `https://vaqtim.pages.dev/privacy/`

### 2.2 App access
- Choose: **All or some functionality in my app is restricted**
- Click **Add instructions**:
  - Name: `Vaqtim demo account`
  - Username / email: the demo account email you create for reviewers
  - Password: its password
  - Any other information:
    ```
    Sign in with email on the first screen ("Continue with email" → Sign in).
    YouTube works without signing in to YouTube. Instagram needs the reviewer's own Instagram account to show content.
    To see blocking: open the YouTube filters on Home, turn on the Shorts filter and allow the Accessibility service when asked.
    ```
- Allow Android to use the credentials for review: tick if offered.

### 2.3 Ads
- **No, my app does not contain ads**

### 2.4 Content rating
Click **Start questionnaire**.
- Email address: your email
- Category: **All Other App Types**
- Answer each question:

| Question area | Answer |
|---|---|
| Violence, blood, fear | No |
| Sexuality, nudity | No |
| Language (profanity) | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling, simulated gambling | No |
| Crude humor | No |
| Does the app allow users to interact or exchange content with other users? | **Yes** (Instagram and YouTube accounts, messages and comments inside the app) |
| Does the app share the user's current physical location? | No |
| Does the app allow purchases of digital goods? | No |
| Is the app a web browser or search engine? | No |
| Does the app contain NFTs or blockchain? | No |

Click **Save → Calculate rating → Submit**. A teen rating is expected and fine.

### 2.5 Target audience and content
- Target age groups: tick **16–17** and **18 and over** only.
- Could your store listing unintentionally appeal to children? **No**.
- Save.

### 2.6 News apps
- Is your app a news app? **No**

### 2.7 Data safety
Click **Start**.

**Step 1 – Overview:** Next.

**Step 2 – Data collection and security**
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Which account creation methods does your app support? | **Username and password**, and **OAuth** (Apple, Google, Telegram) |
| Delete account URL | `https://vaqtim.pages.dev/delete-account/` |
| Do you provide a way for users to request deletion of some data without deleting their account? | **Yes** (by email, as the privacy policy says) |

**Step 3 – Data types.** Tick exactly these:
- Personal info: **Name**, **Email address**, **User IDs**
- Messages: **Other in-app messages**
- App activity: **App interactions**, **Other actions**
- App info and performance: **Crash logs**, **Diagnostics**
- Device or other IDs: **Device or other IDs**

Leave everything else unticked (location, financial info, health, photos, audio, files, calendar, contacts, web browsing, installed apps).

**Step 4 – Data usage and handling.** For each ticked type, answer:

| Data type | Collected / Shared | Processed ephemerally? | Required or optional | Purposes |
|---|---|---|---|---|
| Name | Collected, not shared | No | Optional | App functionality, Account management |
| Email address | Collected, not shared | No | Required | App functionality, Account management |
| User IDs | Collected, not shared | No | Required | App functionality, Analytics, Account management |
| Other in-app messages | Collected, not shared | No | Optional | Developer communications |
| App interactions | Collected, not shared | No | Optional | Analytics |
| Other actions | Collected, not shared | No | Optional | Analytics, App functionality |
| Crash logs | Collected, not shared | No | Optional | Analytics |
| Diagnostics | Collected, not shared | No | Optional | Analytics |
| Device or other IDs | Collected, not shared | No | Required | App functionality, Analytics |

"Shared" means sent to another company for its own use. Supabase, PostHog, Expo and Telegram only process data for Vaqtim, so it is **not shared**.

**Step 5 – Preview:** check and **Submit**.

### 2.8 Government apps
- **No**

### 2.9 Financial features
- **My app doesn't provide any financial features**

### 2.10 Health apps
- **My app does not have any health features**

### 2.11 Advertising ID
- Does your app use advertising ID? **No** (no library in the app adds the AD_ID permission)

### 2.12 Select an app category and provide contact details
**Grow users → Store presence → Store settings**
| Field | Enter |
|---|---|
| App or game | App |
| Category | **Productivity** |
| Tags | Productivity; also any offered tag about digital wellbeing or focus (up to 5) |
| Email address | your support email |
| Phone number | optional, leave empty |
| Website | `https://vaqtim.pages.dev` |
| External marketing | leave ticked |

### 2.13 Set up your store listing
**Grow users → Store presence → Main store listing**

| Field | Enter |
|---|---|
| App name | `Vaqtim: Block Reels & Shorts` |
| Short description | `Instagram and YouTube without Reels and Shorts. Messages and friends stay.` |
| Full description | copy the English block from [google-play.md](google-play.md#english) |
| App icon (512 × 512) | `store/google-play/icon-512.png` |
| Feature graphic (1024 × 500) | `store/google-play/feature-graphic-en.png` |
| Phone screenshots (2–8) | needed before Closed testing (internal testing works without them) |
| Tablet / Chromebook / Wear screenshots | leave empty |
| Video | leave empty |

Save.

**Translations:** on the same page, **Manage translations → Add your own translations** → tick **Russian – ru-RU** (and **Uzbek** if listed). Then switch the language selector at the top of the listing to each language and paste the Russian / Uzbek texts from [google-play.md](google-play.md#russian), with `feature-graphic-ru.png` / `feature-graphic-uz.png`.

---

## Screen 3: Internal testing (first upload)

**Test and release → Testing → Internal testing**
1. **Testers** tab → **Create email list** → name `Team` → add your Gmail → Save. Tick the list.
2. **Releases** tab → **Create new release**.
3. Play App Signing: **Use Google-generated key** (default) → Continue.
4. **App bundles** → Upload the `.aab` (download it first: https://expo.dev/artifacts/eas/GAcdQVesiR9fX7y2TXa-POoSxrUPZQ2KBVTTDt1Z2Ls.aab).
5. Release name: `1.0.0 (2)` (filled automatically).
6. Release notes (en-US):
   ```
   <en-US>
   First test build of Vaqtim.
   </en-US>
   ```
7. **Next → Save → Go to overview → Send for review** (internal tests are usually available within minutes to a few hours).
8. **Testers** tab → copy the **Join on the web** link, open it on your Android phone with the same Gmail, accept, then install Vaqtim from Google Play.

### Accessibility declaration (appears after the upload)
**Policy → App content → Sensitive app permissions → Accessibility API** (Play Console shows a task once it sees the Accessibility service in the bundle):
- Core functionality based on Accessibility? **No**
- Description: paste the declaration from [google-play.md](google-play.md#sensitive-permissions)
- Video link: an unlisted YouTube video recorded with the steps in the same section

---

## Screen 4: Closed testing (the 14-day test)

Needed before Production because the developer account is personal.

1. Add at least **2 phone screenshots** to the store listing first.
2. **Test and release → Testing → Closed testing → Create track** (or use **Alpha**).
3. **Testers** → create a list with **12 or more** Gmail addresses (friends, family). Or use a Google Group.
4. **Releases → Create new release → Add from library** → pick `1.0.0 (2)` → Save → **Send for review**.
5. Share the **Join on the web** link. Each tester must join, install and keep the app for **14 days in a row**; ask them to open it a few times.
6. After 14 days: **Dashboard → Apply for production** and answer the questions about the test (what you tested, feedback, changes).

---

## Can this be automated?

| Part | Automatic? |
|---|---|
| Uploading new builds | **Yes**, after the first manual upload: `npx eas-cli@latest submit -p android --profile production`. Needs a Google service account key (Play Console → Setup → API access). |
| Store listing text and images | Possible through the Google Play Developer API with the same service account. Ask me to add a script when you have the key. |
| Data safety | Partly: Play Console's Data safety page has **Export to CSV / Import from CSV**. Fill it once by hand, then keep the export. |
| Content rating, target audience, app access, ads, Accessibility declaration | **No**, Google only accepts these through the Console forms. |
