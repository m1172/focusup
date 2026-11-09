// All website text, at /uz/, /ru/ and /en/ (/ picks one from the browser language).
// Facts here must match the app: keep claims about data in sync with docs/observability.md and the backend.

import { APP_STORE_URL, PLAY_STORE_URL } from './stores';

export const locales = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof locales)[number];
export const isLocale = (value: string): value is Locale => (locales as readonly string[]).includes(value);

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vaqtim.com';
export const SUPPORT_EMAIL = 'vaqtim.app@gmail.com';
// Store links (src/content/stores.ts). Set a NEXT_PUBLIC_* variable to an empty string at build time to show
// "coming soon" instead.
export const STORE = { ios: process.env.NEXT_PUBLIC_APP_STORE_URL ?? APP_STORE_URL, android: process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? PLAY_STORE_URL };
// Pro and Family: base USD prices (docs/subscriptions-setup.md). The stores show the local price.
// Until they are on sale, the plans show "Coming soon"; build with NEXT_PUBLIC_PLANS_LIVE=1 at launch.
export const PLANS_LIVE = process.env.NEXT_PUBLIC_PLANS_LIVE === '1';
export const PRICES = { pro: { month: 1.99, year: 14.99 }, family: { month: 3.99, year: 29.99 } } as const;
export const UPDATED: Record<Locale, string> = { uz: '2026-yil 24-oktabr', ru: '24 октября 2026 г.', en: '24 October 2026' };

export const content = {
  uz: {
    htmlLang: 'uz', name: 'O‘zbekcha',
    meta: { title: 'Vaqtim — Instagram va YouTube, Reels va Shorts’siz', description: 'Vaqtim Instagram va YouTube’dan Reels va Shorts’ni olib tashlaydi. Xabarlar, do‘stlar va oddiy videolar joyida qoladi. Bepul.' },
    nav: { how: 'Qanday ishlaydi', apps: 'Ilovalar', pricing: 'Narxlar', faq: 'Savollar', support: 'Yordam' },
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
        ['Vaqtim bepulmi?', 'Ha. Instagram, YouTube va TikTok’ni Reels, Shorts va For You’siz ishlatish bepul. Pro va Family — qo‘shimcha imkoniyatlarga ega ixtiyoriy pullik tariflar.'],
        ['O‘z hisobimdan foydalana olamanmi?', 'Ha. Vaqtim ichida o‘z Instagram yoki YouTube hisobingizga kirasiz. Xabarlar, obunalar va postlaringiz o‘zgarmaydi.'],
        ['Kirish xavfsizmi?', 'Siz Instagram va Google’ning o‘z sahifalarida kirasiz. Parolingiz bizning serverimizga hech qachon yuborilmaydi.'],
        ['Asl ilovani bloklaydimi?', 'Ixtiyoriy. iPhone’da asl ilovani ochsangiz, o‘rniga Vaqtim ochiladi. Android’da asl Instagram va YouTube’da faqat Reels va Shorts yopiladi, TikTok esa to‘liq bloklanadi. Istalgan vaqtda o‘chirasiz.'],
        ['Post joylay olamanmi?', 'Ha. Vaqtim ichida xabar yozasiz va postlarni ko‘rasiz. Post yoki video joylash uchun Post rejimi asl ilovani 10 daqiqaga ochadi (kuniga 3 marta). Android’da asl ilova ochiq qoladi, faqat Reels va Shorts yopiladi.'],
        ['Qaysi telefonlarda ishlaydi?', 'iPhone va Android’da. Asl ilovani bloklash uchun iPhone’da Screen Time, Android’da esa Maxsus imkoniyatlar ruxsati kerak.'],
        ['Hisobimni qanday o‘chiraman?', 'Ilovada: Sozlamalar → Hisob → Hisobni o‘chirish. Yoki “Hisobni o‘chirish” sahifasidagi ko‘rsatmaga amal qiling.'],
      ],
    },
    controls: {
      title: 'Har bir ilovada nima qolishini o‘zingiz tanlaysiz',
      lead: 'Qisqa videolar doim yopiq. Qolganini ilovaning sozlamalarida o‘zingiz yoqasiz yoki o‘chirasiz.',
      always: 'Doim yopiq', choose: 'Tanlaysiz', experimental: 'tajribaviy',
      apps: {
        instagram: { tagline: 'Do‘stlar va xabarlar qoladi', items: [['Reels', 'always'], ['Explore', 'choose'], ['Tavsiya etilgan postlar', 'choose'], ['Stories', 'exp'], ['Reklama postlari', 'exp'], ['Faqat xabarlar rejimi', 'exp'], ['5 tagacha akkaunt', 'feature']] },
        youtube: { tagline: 'O‘zingiz tanlagan videolar uchun joy', items: [['Shorts', 'always'], ['Bosh sahifa tavsiyalari', 'choose'], ['Video ostidagi tavsiyalar', 'choose'], ['Explore va Trendlar', 'exp']] },
        tiktok: { tagline: 'Faqat siz kuzatadiganlar', items: [['For You lentasi', 'always'], ['Following lentasi', 'choose'], ['Explore', 'choose']] },
      },
      featureLabel: 'Imkoniyat', hiddenLabel: 'Yashirilgan',
    },
    calc: {
      title: 'Qisqa videolar qancha vaqtingizni oladi?',
      lead: 'Kuniga qancha vaqt ketishini tanlang.',
      perDay: 'kuniga', h: 'soat', min: 'daq', hours: 'soat yiliga', days: 'bo‘sh kun yiliga', books: 'kitob o‘qish mumkin edi',
      fine: 'Hisob: bir yil = 365 kun, bo‘sh kun = 8 soat, kitob = ~7 soat. Bu taxmin, va’da emas.',
    },
    platforms: {
      title: 'iPhone va Android’da qanday ishlaydi',
      ios: { name: 'iPhone', items: ['Instagram, YouTube va TikTok Vaqtim ichida Reels, Shorts va For You’siz ochiladi.', 'Asl ilovani ochsangiz, Screen Time sizni Vaqtim’ga olib keladi.', 'Post joylash kerakmi? Post rejimi asl ilovani 10 daqiqaga ochadi, kuniga 3 marta.'] },
      android: { name: 'Android', items: ['Asl Instagram va YouTube’da Reels va Shorts yopiladi, qolgani ishlayveradi: xabarlar, postlar, videolar.', 'TikTok to‘liq bloklanadi, chunki uning asosiy ekrani For You.', 'Xohlasangiz, ilovalarning toza versiyalari Vaqtim ichida ham bor.'] },
      note: 'Jadvallar, uyqu rejimi va kunlik limitlar ikkala telefonda ham butun ilovani yopadi.',
    },
    compare: {
      title: 'Oddiy bloklovchilardan farqi',
      other: 'Boshqa ekran vaqti vositalari', ours: 'Vaqtim',
      rows: [['Butun ilovani cheklaydi yoki bloklaydi', 'Ilova ichidagi cheksiz lentalarni olib tashlaydi'], ['Ilova bloklansa, xabarlar ham yopiladi', 'Xabarlar va do‘stlar doim ochiq qoladi'], ['Iroda kuchiga tayanadi: limitni “yana 15 daqiqa”ga uzaytirish oson', 'Lentaning o‘zi yo‘q, shuning uchun uzaytiradigan narsa ham yo‘q']],
      fine: 'Umumiy taqqoslash. Imkoniyatlar mahsulot, tarif va telefonga qarab farq qiladi.',
    },
    pricing: {
      title: 'Asosiysi bepul. Ko‘proq kerak bo‘lsa — Pro va Family',
      lead: 'Reels, Shorts va For You’siz ijtimoiy tarmoqlar hamma uchun bepul. Pro va Family qo‘shimcha imkoniyatlar beradi.',
      monthly: 'Oylik', yearly: 'Yillik', perMonth: '/oy', perYear: '/yil', save: 'Yillikda tejaysiz', yearlyNote: 'oyiga {{price}} ga teng',
      soon: 'Tez orada', now: 'Hozir mavjud', popular: 'Oila uchun',
      free: { name: 'Bepul', price: '$0', tagline: 'Har kim uchun, doim', items: ['Instagram, YouTube va TikTok Reels, Shorts va For You’siz', 'Asl ilovalarni bloklash', 'Explore, tavsiyalar va Stories filtrlari', 'Jadvallar, uyqu rejimi va kunlik limitlar', 'Post rejimi', 'Oq-qora rejim'] },
      pro: { name: 'Pro', tagline: 'Qat’iy bo‘lishni istaganlar uchun', items: ['Bepul tarifdagi hamma narsa', 'Qattiq rejim: tugaguncha o‘chirib bo‘lmaydi', 'Tanaffuslar: ilovani bir necha daqiqaga ochish', 'Boshqa ilovalarni ham bloklash', 'Batafsil statistika', 'YouTube izohlarini yashirish', 'iPhone: kattalar saytlari filtri va o‘chirishdan himoya'] },
      family: { name: 'Family', tagline: 'Ota-ona va 3 tagacha bola', items: ['Ota-ona uchun Pro', '3 tagacha bola, har biriga bitta telefon', 'Bola hisob ochmaydi: bitta kod bilan ulanadi', 'Qaysi ilovalar bloklanishini tanlaysiz', 'Har bir ilova uchun kunlik limit', 'Uyqu va dars vaqtlari', 'Bola Vaqtim ichida qancha vaqt o‘tkazganini ko‘rasiz'] },
      fine: 'Narxlar AQSh dollarida. App Store va Google Play o‘z valyutangizdagi narxni ko‘rsatadi. Obuna avtomatik yangilanadi, do‘kon sozlamalarida istalgan vaqtda bekor qilasiz.',
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
    nav: { how: 'Как работает', apps: 'Приложения', pricing: 'Цены', faq: 'Вопросы', support: 'Поддержка' },
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
        ['Vaqtim бесплатный?', 'Да. Пользоваться Instagram, YouTube и TikTok без Reels, Shorts и For You — бесплатно. Pro и Family — необязательные платные тарифы с дополнительными возможностями.'],
        ['Можно использовать свой аккаунт?', 'Да. Внутри Vaqtim вы входите в свой Instagram или YouTube. Сообщения, подписки и посты не меняются.'],
        ['Безопасно ли входить?', 'Вы входите на страницах самого Instagram и Google. Ваш пароль никогда не отправляется на наш сервер.'],
        ['Блокирует ли он оригинальное приложение?', 'По желанию. На iPhone при открытии настоящего приложения вместо него открывается Vaqtim. На Android в настоящих Instagram и YouTube закрываются только Reels и Shorts, а TikTok блокируется целиком. Выключить можно в любой момент.'],
        ['Можно ли публиковать посты?', 'Да. В Vaqtim можно писать сообщения и смотреть публикации. Чтобы опубликовать пост или видео, режим публикации открывает настоящее приложение на 10 минут (3 раза в день). На Android настоящее приложение остаётся доступным, закрываются только Reels и Shorts.'],
        ['На каких телефонах работает?', 'На iPhone и Android. Для блокировки оригинального приложения нужно разрешение Screen Time на iPhone или Спец. возможностей на Android.'],
        ['Как удалить аккаунт?', 'В приложении: Настройки → Аккаунт → Удалить аккаунт. Или следуйте инструкции на странице «Удаление аккаунта».'],
      ],
    },
    controls: {
      title: 'Вы сами решаете, что остаётся в каждом приложении',
      lead: 'Короткие видео закрыты всегда. Остальное включаете и выключаете в настройках приложения.',
      always: 'Всегда закрыто', choose: 'На ваш выбор', experimental: 'эксперимент',
      apps: {
        instagram: { tagline: 'Друзья и сообщения остаются', items: [['Reels', 'always'], ['Explore', 'choose'], ['Рекомендуемые публикации', 'choose'], ['Stories', 'exp'], ['Рекламные публикации', 'exp'], ['Режим «Только сообщения»', 'exp'], ['До 5 аккаунтов', 'feature']] },
        youtube: { tagline: 'Место для видео, которые выбираете вы', items: [['Shorts', 'always'], ['Рекомендации на главной', 'choose'], ['Рекомендации под видео', 'choose'], ['Explore и Тренды', 'exp']] },
        tiktok: { tagline: 'Только те, на кого вы подписаны', items: [['Лента For You', 'always'], ['Лента Following', 'choose'], ['Explore', 'choose']] },
      },
      featureLabel: 'Функция', hiddenLabel: 'Скрыто',
    },
    calc: {
      title: 'Сколько времени забирают короткие видео?',
      lead: 'Выберите, сколько времени уходит в день.',
      perDay: 'в день', h: 'ч', min: 'мин', hours: 'часов в год', days: 'свободных дней в год', books: 'книг можно было бы прочитать',
      fine: 'Расчёт: год = 365 дней, свободный день = 8 часов, книга = ~7 часов. Это оценка, а не обещание.',
    },
    platforms: {
      title: 'Как это работает на iPhone и Android',
      ios: { name: 'iPhone', items: ['Instagram, YouTube и TikTok открываются внутри Vaqtim без Reels, Shorts и For You.', 'Если открыть настоящее приложение, Экранное время вернёт вас в Vaqtim.', 'Нужно опубликовать пост? Режим публикации открывает настоящее приложение на 10 минут, 3 раза в день.'] },
      android: { name: 'Android', items: ['В настоящих Instagram и YouTube закрываются Reels и Shorts, остальное работает: сообщения, публикации, видео.', 'TikTok блокируется целиком, потому что его главный экран — For You.', 'Чистые версии приложений есть и внутри Vaqtim.'] },
      note: 'Расписания, режим сна и дневные лимиты на обоих телефонах закрывают приложение целиком.',
    },
    compare: {
      title: 'Чем Vaqtim отличается от обычных блокировщиков',
      other: 'Другие инструменты экранного времени', ours: 'Vaqtim',
      rows: [['Ограничивают или блокируют приложение целиком', 'Убирают бесконечные ленты внутри приложения'], ['Если приложение заблокировано, сообщения тоже недоступны', 'Сообщения и друзья всегда доступны'], ['Держатся на силе воли: лимит легко продлить «ещё на 15 минут»', 'Ленты просто нет, поэтому и продлевать нечего']],
      fine: 'Общее сравнение. Возможности зависят от продукта, тарифа и телефона.',
    },
    pricing: {
      title: 'Главное бесплатно. Нужно больше — Pro и Family',
      lead: 'Соцсети без Reels, Shorts и For You бесплатны для всех. Pro и Family добавляют больше возможностей.',
      monthly: 'Месяц', yearly: 'Год', perMonth: '/мес', perYear: '/год', save: 'Выгоднее за год', yearlyNote: 'это {{price}} в месяц',
      soon: 'Скоро', now: 'Уже доступно', popular: 'Для семьи',
      free: { name: 'Бесплатно', price: '$0', tagline: 'Для всех, навсегда', items: ['Instagram, YouTube и TikTok без Reels, Shorts и For You', 'Блокировка настоящих приложений', 'Фильтры Explore, рекомендаций и Stories', 'Расписания, режим сна и дневные лимиты', 'Режим публикации', 'Чёрно-белый режим'] },
      pro: { name: 'Pro', tagline: 'Для тех, кто хочет строже', items: ['Всё из бесплатного', 'Строгий режим: не выключить до конца', 'Перерывы: открыть приложение на несколько минут', 'Блокировка других приложений', 'Подробная статистика', 'Скрытие комментариев YouTube', 'iPhone: фильтр сайтов для взрослых и защита от удаления'] },
      family: { name: 'Family', tagline: 'Родитель и до 3 детей', items: ['Pro для родителя', 'До 3 детей, по одному телефону на каждого', 'Ребёнку не нужен аккаунт: подключение по одному коду', 'Вы выбираете, какие приложения блокировать', 'Дневной лимит для каждого приложения', 'Время сна и уроков', 'Видно, сколько времени ребёнок провёл в Vaqtim'] },
      fine: 'Цены в долларах США. App Store и Google Play покажут цену в вашей валюте. Подписка продлевается автоматически, отменить можно в любой момент в настройках магазина.',
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
    nav: { how: 'How it works', apps: 'Apps', pricing: 'Pricing', faq: 'FAQ', support: 'Support' },
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
        ['Is Vaqtim free?', 'Yes. Using Instagram, YouTube and TikTok without Reels, Shorts and For You is free. Pro and Family are optional paid plans with extra tools.'],
        ['Can I use my own account?', 'Yes. You sign in to your own Instagram or YouTube inside Vaqtim. Your messages, subscriptions and posts don’t change.'],
        ['Is signing in safe?', 'You sign in on Instagram’s and Google’s own pages. Your password is never sent to our server.'],
        ['Does it block the real app?', 'If you want. On iPhone, opening the real app opens Vaqtim instead. On Android, only Reels and Shorts close inside the real Instagram and YouTube, and TikTok is blocked whole. You can turn it off any time.'],
        ['Can I still post?', 'Yes. Inside Vaqtim you message and see posts as usual. To post a photo or video, Post mode opens the real app for 10 minutes (3 times a day). On Android the real app stays open; only Reels and Shorts close.'],
        ['Which phones does it work on?', 'iPhone and Android. Blocking the real app needs Screen Time permission on iPhone or Accessibility permission on Android.'],
        ['How do I delete my account?', 'In the app: Settings → Account → Delete account. Or follow the steps on the “Delete account” page.'],
      ],
    },
    controls: {
      title: 'You choose what stays in each app',
      lead: 'Short videos are always off. Everything else you switch on or off in the app’s settings.',
      always: 'Always off', choose: 'Your choice', experimental: 'experimental',
      apps: {
        instagram: { tagline: 'Friends and messages stay', items: [['Reels', 'always'], ['Explore', 'choose'], ['Suggested posts', 'choose'], ['Stories', 'exp'], ['Sponsored posts', 'exp'], ['Messages-only mode', 'exp'], ['Up to 5 accounts', 'feature']] },
        youtube: { tagline: 'Room for the videos you choose', items: [['Shorts', 'always'], ['Home recommendations', 'choose'], ['Recommendations under videos', 'choose'], ['Explore and Trending', 'exp']] },
        tiktok: { tagline: 'Only the people you follow', items: [['For You feed', 'always'], ['Following feed', 'choose'], ['Explore', 'choose']] },
      },
      featureLabel: 'Feature', hiddenLabel: 'Hidden',
    },
    calc: {
      title: 'How much time do short videos take?',
      lead: 'Pick how long they take each day.',
      perDay: 'a day', h: 'h', min: 'min', hours: 'hours a year', days: 'free days a year', books: 'books you could read',
      fine: 'How we count: a year = 365 days, a free day = 8 hours, a book = about 7 hours. An estimate, not a promise.',
    },
    platforms: {
      title: 'How it works on iPhone and Android',
      ios: { name: 'iPhone', items: ['Instagram, YouTube and TikTok open inside Vaqtim without Reels, Shorts and For You.', 'Open the real app and Screen Time brings you back to Vaqtim.', 'Need to post? Post mode opens the real app for 10 minutes, 3 times a day.'] },
      android: { name: 'Android', items: ['In the real Instagram and YouTube, Reels and Shorts close and everything else works: messages, posts, videos.', 'TikTok is blocked whole, because its main screen is For You.', 'Clean versions of the apps are inside Vaqtim too.'] },
      note: 'On both phones, schedules, Sleep Mode and daily limits close the whole app.',
    },
    compare: {
      title: 'Not just another app blocker',
      other: 'Other screen-time tools', ours: 'Vaqtim',
      rows: [['Limit or block the whole app', 'Remove the endless feeds inside it'], ['When an app is blocked, messages are blocked too', 'Messages and friends stay available'], ['Rely on willpower: “15 more minutes” is one tap away', 'The feed is gone, so there is nothing to extend']],
      fine: 'A general comparison. Features vary by product, plan and phone.',
    },
    pricing: {
      title: 'The essentials are free. Want more? Pro and Family',
      lead: 'Social apps without Reels, Shorts and For You are free for everyone. Pro and Family add more.',
      monthly: 'Monthly', yearly: 'Yearly', perMonth: '/mo', perYear: '/yr', save: 'Save with yearly', yearlyNote: 'just {{price}} a month',
      soon: 'Coming soon', now: 'Available now', popular: 'For families',
      free: { name: 'Free', price: '$0', tagline: 'For everyone, always', items: ['Instagram, YouTube and TikTok without Reels, Shorts and For You', 'Block the real apps', 'Explore, recommendation and Stories filters', 'Schedules, Sleep Mode and daily limits', 'Post mode', 'Grayscale'] },
      pro: { name: 'Pro', tagline: 'For when you want it stricter', items: ['Everything in Free', 'Hard Mode: can’t be turned off until it ends', 'Breaks: open an app for a few minutes', 'Block other apps too', 'Detailed statistics', 'Hide YouTube comments', 'iPhone: adult-site filter and delete protection'] },
      family: { name: 'Family', tagline: 'A parent and up to 3 children', items: ['Pro for the parent', 'Up to 3 children, one phone each', 'No account for your child: they connect with one code', 'Choose which apps are blocked', 'A daily limit for each app', 'Bedtime and homework time', 'See how long your child spends in Vaqtim'] },
      fine: 'Prices in US dollars. The App Store and Google Play show the price in your currency. Subscriptions renew automatically; cancel any time in your store settings.',
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
