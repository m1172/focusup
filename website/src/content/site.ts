// All website text, at /uz/, /ru/ and /en/ (/ picks one from the browser language).
// Facts here must match the app: keep claims about data in sync with docs/observability.md and the backend.

export const locales = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof locales)[number];
export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vaqtim.com';
export const SUPPORT_EMAIL = 'support@vaqtim.com';
// Store links: leave empty until the apps are live; the buttons then say "coming soon".
export const STORE = { ios: process.env.NEXT_PUBLIC_APP_STORE_URL ?? '', android: process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '' };
export const UPDATED: Record<Locale, string> = { uz: '2026-yil 24-oktabr', ru: '24 октября 2026 г.', en: '24 October 2026' };

export const content = {
  uz: {
    htmlLang: 'uz', name: 'O‘zbekcha',
    meta: { title: 'Vaqtim — Instagram va YouTube, Reels va Shorts’siz', description: 'Vaqtim Instagram va YouTube’dan Reels va Shorts’ni olib tashlaydi. Xabarlar, do‘stlar va oddiy videolar joyida qoladi. Bepul.' },
    nav: { how: 'Qanday ishlaydi', faq: 'Savollar', support: 'Yordam' },
    store: { soon: 'Tez orada', ios: 'App Store', android: 'Google Play' },
    hero: { eyebrow: 'Instagram va YouTube — Reels va Shorts’siz', title: 'Vaqtingiz yana o‘zingizniki.', accent: [2], lead: 'Vaqtim qisqa videolarni olib tashlaydi. Xabarlar, do‘stlar, profillar va oddiy videolar joyida qoladi.', note: 'Bepul. iPhone va Android uchun.' },
    phone: { app: 'Instagram', clean: 'Toza', gone: 'Reels yashirildi', who: 'do‘stingiz' },
    split: {
      title: 'Faqat chalg‘itadigan qismi yo‘qoladi',
      lead: 'Ijtimoiy tarmoqdan voz kechish shart emas. Cheksiz lentani olib tashlaymiz, kerakli narsalar qoladi.',
      goneTitle: 'Yo‘qoladi', gone: ['Instagram Reels', 'YouTube Shorts', 'Cheksiz qisqa video lentasi'],
      keptTitle: 'Qoladi', kept: ['Xabarlar va do‘stlar', 'Profillar va postlar', 'Oddiy YouTube videolari', 'Obunalaringiz'],
    },
    how: {
      title: 'Qanday ishlaydi',
      steps: [
        ['Hisobingizga kiring', 'Instagram yoki YouTube’ni Vaqtim ichida oching va odatdagidek kiring. Parolingiz faqat ijtimoiy tarmoqqa yuboriladi.'],
        ['Reels va Shorts yo‘qoladi', 'Qisqa video bo‘limlari yashiriladi. Qolgan hammasi avvalgidek ishlaydi.'],
        ['Asl ilova Vaqtim’ga yo‘naltiradi', 'Xohlasangiz, asl Instagram yoki YouTube ochilganda uning o‘rniga Vaqtim ochiladi.'],
      ],
    },
    numbers: {
      title: 'Kichik raqam, katta yil',
      lead: 'Kuniga atigi 1,5 soat qisqa video — bir yilda shuncha bo‘ladi:',
      stats: [['548', 'soat yiliga'], ['68', 'bo‘sh kun yiliga'], ['78', 'kitob o‘qish mumkin edi']],
      fine: 'Misol hisob: kuniga 1,5 soat, bo‘sh kun = 8 soat, kitob = ~7 soat. Ilova sizning javobingiz asosida hisoblaydi.',
    },
    privacy: {
      title: 'Maxfiylik birinchi o‘rinda',
      items: [
        ['Parollar sizda qoladi', 'Instagram va YouTube’ga kirish ma’lumotlari bizning serverimizga yuborilmaydi.'],
        ['Tanlovlar telefonda', 'Bloklanadigan ilovalar va Screen Time ruxsatlari faqat telefoningizda saqlanadi.'],
        ['Istalgan vaqtda o‘chiring', 'Hisobingiz va u bilan bog‘liq ma’lumotlarni ilova ichida bir necha bosishda o‘chirasiz.'],
      ],
    },
    faq: {
      title: 'Ko‘p beriladigan savollar',
      items: [
        ['Vaqtim bepulmi?', 'Ha. Instagram va YouTube’ni Reels va Shorts’siz ishlatish bepul.'],
        ['O‘z hisobimdan foydalana olamanmi?', 'Ha. Vaqtim ichida o‘z Instagram yoki YouTube hisobingizga kirasiz. Xabarlar, obunalar va postlaringiz o‘zgarmaydi.'],
        ['Kirish xavfsizmi?', 'Siz Instagram va Google’ning o‘z sahifalarida kirasiz. Parolingiz bizning serverimizga hech qachon yuborilmaydi.'],
        ['Asl ilovani bloklaydimi?', 'Ixtiyoriy. Reels yoki Shorts filtrini yoqsangiz, Vaqtim asl ilovani bloklashni taklif qiladi va uni ochganda Vaqtim ochiladi. Istalgan vaqtda o‘chirasiz.'],
        ['Qaysi telefonlarda ishlaydi?', 'iPhone va Android’da. Asl ilovani bloklash uchun iPhone’da Screen Time, Android’da esa Maxsus imkoniyatlar ruxsati kerak.'],
        ['Hisobimni qanday o‘chiraman?', 'Ilovada: Sozlamalar → Hisob → Hisobni o‘chirish. Yoki “Hisobni o‘chirish” sahifasidagi ko‘rsatmaga amal qiling.'],
      ],
    },
    final: { title: 'Kamroq lenta. Ko‘proq hayot.', lead: 'Vaqtimni yuklab oling va vaqtingizni qaytarib oling.' },
    footer: { product: 'Mahsulot', support: 'Yordam', privacy: 'Maxfiylik siyosati', terms: 'Foydalanish shartlari', del: 'Hisobni o‘chirish', rights: 'Barcha huquqlar himoyalangan.', disclaimer: 'Instagram — Meta Platforms, Inc., YouTube — Google LLC savdo belgilari. Vaqtim ular bilan bog‘liq emas.' },
    support: {
      title: 'Yordam', lead: 'Savol, muammo yoki taklif bormi? Yozing — odatda bir ish kuni ichida javob beramiz.',
      appTitle: 'Ilova ichida yozish', app: 'Vaqtim → Sozlamalar → Yordam. Bu eng tez yo‘l: javob ilovaga keladi.',
      mailTitle: 'Elektron pochta', mailCta: 'Xat yozish',
    },
    del: {
      title: 'Hisobni o‘chirish',
      lead: 'Vaqtim hisobingizni va u bilan bog‘liq ma’lumotlarni istalgan vaqtda o‘chirishingiz mumkin.',
      appTitle: 'Ilova ichida (eng tez)', appSteps: ['Vaqtim ilovasini oching.', 'Sozlamalar → Hisob’ga o‘ting.', '“Hisobni o‘chirish”ni bosing va tasdiqlang.'],
      mailTitle: 'Ilovaga kira olmasangiz', mail: 'Hisobingiz elektron pochtasidan bizga “Hisobni o‘chirish” mavzusida xat yozing. 30 kun ichida o‘chiramiz.',
      whatTitle: 'Nima o‘chiriladi', what: ['Hisob (elektron pochta, ism, kirish usullari)', 'Sozlamalar zaxirasi', 'Yordam chatidagi xabarlar', 'Bildirishnoma tokenlari', 'Telefondagi barcha Vaqtim ma’lumotlari'],
      keepTitle: 'Nima qoladi', keep: 'App Store yoki Google Play obunasi do‘kon hisobingizda qoladi — uni do‘kon sozlamalarida bekor qiling. Analitika yozuvlarini o‘chirishni xat orqali so‘rashingiz mumkin.',
    },
  },

  ru: {
    htmlLang: 'ru', name: 'Русский',
    meta: { title: 'Vaqtim — Instagram и YouTube без Reels и Shorts', description: 'Vaqtim убирает Reels и Shorts из Instagram и YouTube. Сообщения, друзья и обычные видео остаются. Бесплатно.' },
    nav: { how: 'Как работает', faq: 'Вопросы', support: 'Поддержка' },
    store: { soon: 'Скоро', ios: 'App Store', android: 'Google Play' },
    hero: { eyebrow: 'Instagram и YouTube — без Reels и Shorts', title: 'Ваше время снова ваше.', accent: [3], lead: 'Vaqtim убирает короткие видео. Сообщения, друзья, профили и обычные видео остаются.', note: 'Бесплатно. Для iPhone и Android.' },
    phone: { app: 'Instagram', clean: 'Чисто', gone: 'Reels скрыты', who: 'ваш друг' },
    split: {
      title: 'Исчезает только то, что отвлекает',
      lead: 'Не нужно уходить из соцсетей. Мы убираем бесконечную ленту — нужное остаётся.',
      goneTitle: 'Исчезает', gone: ['Instagram Reels', 'YouTube Shorts', 'Бесконечная лента коротких видео'],
      keptTitle: 'Остаётся', kept: ['Сообщения и друзья', 'Профили и посты', 'Обычные видео на YouTube', 'Ваши подписки'],
    },
    how: {
      title: 'Как это работает',
      steps: [
        ['Войдите в свой аккаунт', 'Откройте Instagram или YouTube внутри Vaqtim и войдите как обычно. Пароль уходит только в соцсеть.'],
        ['Reels и Shorts исчезают', 'Разделы с короткими видео скрыты. Всё остальное работает как раньше.'],
        ['Оригинальное приложение ведёт в Vaqtim', 'По желанию: когда вы открываете настоящий Instagram или YouTube, вместо него открывается Vaqtim.'],
      ],
    },
    numbers: {
      title: 'Маленькая цифра, большой год',
      lead: 'Всего 1,5 часа коротких видео в день — это за год:',
      stats: [['548', 'часов в год'], ['68', 'свободных дней в год'], ['78', 'книг можно было прочитать']],
      fine: 'Пример расчёта: 1,5 часа в день, свободный день = 8 часов, книга ≈ 7 часов. Приложение считает по вашим ответам.',
    },
    privacy: {
      title: 'Конфиденциальность прежде всего',
      items: [
        ['Пароли остаются у вас', 'Данные входа в Instagram и YouTube не отправляются на наш сервер.'],
        ['Выбор хранится на телефоне', 'Блокируемые приложения и разрешения Screen Time хранятся только на вашем телефоне.'],
        ['Удаление в любой момент', 'Удалите аккаунт и связанные с ним данные прямо в приложении в пару нажатий.'],
      ],
    },
    faq: {
      title: 'Частые вопросы',
      items: [
        ['Vaqtim бесплатный?', 'Да. Пользоваться Instagram и YouTube без Reels и Shorts — бесплатно.'],
        ['Можно использовать свой аккаунт?', 'Да. Внутри Vaqtim вы входите в свой Instagram или YouTube. Сообщения, подписки и посты не меняются.'],
        ['Безопасно ли входить?', 'Вы входите на страницах самого Instagram и Google. Ваш пароль никогда не отправляется на наш сервер.'],
        ['Блокирует ли он оригинальное приложение?', 'По желанию. Когда вы включаете фильтр Reels или Shorts, Vaqtim предлагает заблокировать оригинальное приложение — при его открытии откроется Vaqtim. Можно выключить в любой момент.'],
        ['На каких телефонах работает?', 'На iPhone и Android. Для блокировки оригинального приложения нужно разрешение Screen Time на iPhone или Спец. возможностей на Android.'],
        ['Как удалить аккаунт?', 'В приложении: Настройки → Аккаунт → Удалить аккаунт. Или следуйте инструкции на странице «Удаление аккаунта».'],
      ],
    },
    final: { title: 'Меньше ленты. Больше жизни.', lead: 'Скачайте Vaqtim и верните своё время.' },
    footer: { product: 'Продукт', support: 'Поддержка', privacy: 'Политика конфиденциальности', terms: 'Условия использования', del: 'Удаление аккаунта', rights: 'Все права защищены.', disclaimer: 'Instagram — товарный знак Meta Platforms, Inc., YouTube — Google LLC. Vaqtim с ними не связан.' },
    support: {
      title: 'Поддержка', lead: 'Есть вопрос, проблема или идея? Напишите — обычно отвечаем в течение рабочего дня.',
      appTitle: 'Написать в приложении', app: 'Vaqtim → Настройки → Поддержка. Самый быстрый способ: ответ придёт в приложение.',
      mailTitle: 'Электронная почта', mailCta: 'Написать письмо',
    },
    del: {
      title: 'Удаление аккаунта',
      lead: 'Вы можете удалить аккаунт Vaqtim и связанные с ним данные в любой момент.',
      appTitle: 'В приложении (быстрее всего)', appSteps: ['Откройте Vaqtim.', 'Перейдите в Настройки → Аккаунт.', 'Нажмите «Удалить аккаунт» и подтвердите.'],
      mailTitle: 'Если не можете войти', mail: 'Напишите нам с почты аккаунта письмо с темой «Удалить аккаунт». Мы удалим его в течение 30 дней.',
      whatTitle: 'Что удаляется', what: ['Аккаунт (почта, имя, способы входа)', 'Резервная копия настроек', 'Сообщения в чате поддержки', 'Токены уведомлений', 'Все данные Vaqtim на телефоне'],
      keepTitle: 'Что остаётся', keep: 'Подписка App Store или Google Play остаётся в вашем аккаунте магазина — отмените её в настройках магазина. Удаление аналитических записей можно запросить письмом.',
    },
  },

  en: {
    htmlLang: 'en', name: 'English',
    meta: { title: 'Vaqtim — Instagram and YouTube without Reels and Shorts', description: 'Vaqtim removes Reels and Shorts from Instagram and YouTube. Messages, friends and regular videos stay. Free.' },
    nav: { how: 'How it works', faq: 'FAQ', support: 'Support' },
    store: { soon: 'Coming soon', ios: 'App Store', android: 'Google Play' },
    hero: { eyebrow: 'Instagram and YouTube — without Reels and Shorts', title: 'Your time is yours again.', accent: [3], lead: 'Vaqtim removes short videos. Messages, friends, profiles and regular videos stay.', note: 'Free. For iPhone and Android.' },
    phone: { app: 'Instagram', clean: 'Clean', gone: 'Reels hidden', who: 'your friend' },
    split: {
      title: 'Only the distracting part disappears',
      lead: 'You don’t have to quit social media. We remove the endless feed and keep what you need.',
      goneTitle: 'Gone', gone: ['Instagram Reels', 'YouTube Shorts', 'Endless short-video feeds'],
      keptTitle: 'Kept', kept: ['Messages and friends', 'Profiles and posts', 'Regular YouTube videos', 'Your subscriptions'],
    },
    how: {
      title: 'How it works',
      steps: [
        ['Sign in to your account', 'Open Instagram or YouTube inside Vaqtim and sign in as usual. Your password only goes to the social network.'],
        ['Reels and Shorts disappear', 'Short-video sections are hidden. Everything else works as before.'],
        ['The real app sends you to Vaqtim', 'If you want: when you open the real Instagram or YouTube, Vaqtim opens instead.'],
      ],
    },
    numbers: {
      title: 'A small number, a big year',
      lead: 'Just 1.5 hours of short videos a day adds up to this in a year:',
      stats: [['548', 'hours a year'], ['68', 'free days a year'], ['78', 'books you could have read']],
      fine: 'Example: 1.5 hours a day, a free day = 8 hours, a book ≈ 7 hours. The app calculates from your own answers.',
    },
    privacy: {
      title: 'Privacy first',
      items: [
        ['Your passwords stay yours', 'Your Instagram and YouTube sign-in details are never sent to our server.'],
        ['Choices stay on your phone', 'Blocked apps and Screen Time permissions are stored only on your phone.'],
        ['Delete any time', 'Delete your account and the data linked to it in a few taps inside the app.'],
      ],
    },
    faq: {
      title: 'Frequently asked questions',
      items: [
        ['Is Vaqtim free?', 'Yes. Using Instagram and YouTube without Reels and Shorts is free.'],
        ['Can I use my own account?', 'Yes. You sign in to your own Instagram or YouTube inside Vaqtim. Your messages, subscriptions and posts don’t change.'],
        ['Is signing in safe?', 'You sign in on Instagram’s and Google’s own pages. Your password is never sent to our server.'],
        ['Does it block the real app?', 'If you want. When you turn on the Reels or Shorts filter, Vaqtim offers to block the real app, so opening it opens Vaqtim instead. You can turn it off any time.'],
        ['Which phones does it work on?', 'iPhone and Android. Blocking the real app needs Screen Time permission on iPhone or Accessibility permission on Android.'],
        ['How do I delete my account?', 'In the app: Settings → Account → Delete account. Or follow the steps on the “Delete account” page.'],
      ],
    },
    final: { title: 'Less scrolling. More life.', lead: 'Download Vaqtim and take your time back.' },
    footer: { product: 'Product', support: 'Support', privacy: 'Privacy Policy', terms: 'Terms of Use', del: 'Delete account', rights: 'All rights reserved.', disclaimer: 'Instagram is a trademark of Meta Platforms, Inc. and YouTube of Google LLC. Vaqtim is not affiliated with them.' },
    support: {
      title: 'Support', lead: 'A question, a problem or an idea? Write to us — we usually reply within one working day.',
      appTitle: 'Write in the app', app: 'Vaqtim → Settings → Support. The fastest way: the reply arrives in the app.',
      mailTitle: 'Email', mailCta: 'Send an email',
    },
    del: {
      title: 'Delete your account',
      lead: 'You can delete your Vaqtim account and the data linked to it at any time.',
      appTitle: 'In the app (fastest)', appSteps: ['Open Vaqtim.', 'Go to Settings → Account.', 'Tap “Delete account” and confirm.'],
      mailTitle: 'If you can’t sign in', mail: 'Email us from your account’s email address with the subject “Delete account”. We’ll delete it within 30 days.',
      whatTitle: 'What is deleted', what: ['Your account (email, name, sign-in methods)', 'Your settings backup', 'Support chat messages', 'Notification tokens', 'All Vaqtim data on your phone'],
      keepTitle: 'What stays', keep: 'An App Store or Google Play subscription stays with your store account — cancel it in the store’s settings. You can ask us by email to delete analytics records.',
    },
  },
};
