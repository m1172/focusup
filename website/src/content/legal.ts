// Privacy Policy and Terms of Use. Drafted from how the app actually works (October 2026);
// have a lawyer review them and fill in the operator's legal name and address before launch (see README).
import { SUPPORT_EMAIL, type Locale } from './site';

export type LegalDoc = { title: string; intro: string; sections: [string, string[]][] };

const mail = `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;

export const privacy: Record<Locale, LegalDoc> = {
  en: {
    title: 'Privacy Policy',
    intro: `This policy explains what the Vaqtim app (“Vaqtim”, “we”) collects, why, and the choices you have. Questions: ${mail}.`,
    sections: [
      ['What stays on your phone', [
        'Your Instagram, YouTube and other social network sign-ins, cookies and passwords. You sign in on the social network’s own pages inside the app; we never receive these details.',
        'What you view, post or send on social networks.',
        'The apps you choose to block, and Screen Time (iPhone) or Accessibility (Android) permissions. On Android, the Accessibility service only checks which app is open to show the Vaqtim screen; it does not read messages, passwords, typed text or screen content.',
      ]],
      ['What we collect', [
        '<b>Account:</b> your email address, display name and the sign-in method you use (email, Apple, Google or Telegram).',
        '<b>Settings backup:</b> your app settings (for example which filters are on) so they can be restored on a new phone.',
        '<b>Support messages:</b> messages you send in the in-app support chat, with your account email and name, and a notification token so we can tell you about replies.',
        '<b>Usage analytics, session replay and crash reports</b> (if enabled): app events such as which screens you open, weekly time summaries, recordings of Vaqtim’s own screens and crash details. Passwords, email fields, the account screen and all social network content are masked. You can turn this off at any time in Settings → Privacy.',
        '<b>Purchases</b> (when paid plans launch): handled by Apple or Google. We receive your subscription status, not your card details.',
      ]],
      ['Why we use it', [
        'To run your account, restore your settings, answer support requests, fix crashes and improve the app. We do not sell your data and we do not show ads.',
      ]],
      ['Service providers', [
        'We use trusted providers to run the app: Supabase (accounts, database and hosting), PostHog (analytics, session replay and crash reports), Telegram (delivering support messages to our team), Expo (push notifications), Apple and Google (sign-in, purchases and app distribution) and RevenueCat (subscription status). They process data only to provide their service to us.',
      ]],
      ['How long we keep it', [
        'We keep your account data until you delete your account. Analytics data is kept for a limited period and deleted on request.',
      ]],
      ['Your choices and rights', [
        'Turn analytics and session replay off in Settings → Privacy.',
        'Delete your account in Settings → Account → Delete account. This deletes your account, settings backup, support messages and notification tokens from our servers and all Vaqtim data on your phone. See <a href="../delete-account/">Delete account</a>.',
        `Ask us for a copy of your data, to correct it, or to delete analytics records: ${mail}.`,
      ]],
      ['Children', [
        'Vaqtim is not directed at children under 13.',
      ]],
      ['Changes', [
        'If we change this policy, we will update the date below and, for important changes, tell you in the app.',
      ]],
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    intro: `Эта политика объясняет, какие данные собирает приложение Vaqtim («Vaqtim», «мы»), зачем и какой у вас выбор. Вопросы: ${mail}.`,
    sections: [
      ['Что остаётся на вашем телефоне', [
        'Данные входа, cookie и пароли Instagram, YouTube и других соцсетей. Вы входите на страницах самой соцсети внутри приложения; мы эти данные не получаем.',
        'То, что вы смотрите, публикуете или отправляете в соцсетях.',
        'Выбранные для блокировки приложения и разрешения Screen Time (iPhone) или Спец. возможностей (Android). На Android служба Спец. возможностей только проверяет, какое приложение открыто, чтобы показать экран Vaqtim; она не читает сообщения, пароли, вводимый текст и содержимое экрана.',
      ]],
      ['Что мы собираем', [
        '<b>Аккаунт:</b> адрес почты, отображаемое имя и способ входа (почта, Apple, Google или Telegram).',
        '<b>Резервная копия настроек:</b> настройки приложения (например, какие фильтры включены), чтобы восстановить их на новом телефоне.',
        '<b>Сообщения в поддержку:</b> сообщения из чата поддержки в приложении вместе с почтой и именем аккаунта, а также токен уведомлений, чтобы сообщать об ответах.',
        '<b>Аналитика, запись сеансов и отчёты о сбоях</b> (если включены): события приложения, например какие экраны вы открываете, недельные сводки времени, записи собственных экранов Vaqtim и данные о сбоях. Пароли, поля почты, экран аккаунта и весь контент соцсетей скрываются. Это можно выключить в Настройки → Конфиденциальность.',
        '<b>Покупки</b> (когда появятся платные тарифы): обрабатываются Apple или Google. Мы получаем статус подписки, а не данные карты.',
      ]],
      ['Зачем мы их используем', [
        'Чтобы обслуживать ваш аккаунт, восстанавливать настройки, отвечать в поддержке, исправлять сбои и улучшать приложение. Мы не продаём ваши данные и не показываем рекламу.',
      ]],
      ['Поставщики услуг', [
        'Для работы приложения мы используем надёжных поставщиков: Supabase (аккаунты, база данных и хостинг), PostHog (аналитика, запись сеансов и отчёты о сбоях), Telegram (доставка сообщений поддержки нашей команде), Expo (push-уведомления), Apple и Google (вход, покупки и распространение приложения) и RevenueCat (статус подписки). Они обрабатывают данные только для оказания нам своих услуг.',
      ]],
      ['Сколько мы храним данные', [
        'Данные аккаунта хранятся, пока вы не удалите аккаунт. Аналитические данные хранятся ограниченный срок и удаляются по запросу.',
      ]],
      ['Ваш выбор и права', [
        'Выключите аналитику и запись сеансов в Настройки → Конфиденциальность.',
        'Удалите аккаунт в Настройки → Аккаунт → Удалить аккаунт. Это удалит аккаунт, резервную копию настроек, сообщения поддержки и токены уведомлений с наших серверов и все данные Vaqtim на телефоне. См. <a href="../delete-account/">Удаление аккаунта</a>.',
        `Запросите копию своих данных, их исправление или удаление аналитических записей: ${mail}.`,
      ]],
      ['Дети', [
        'Vaqtim не предназначен для детей младше 13 лет.',
      ]],
      ['Изменения', [
        'Если мы изменим политику, мы обновим дату ниже, а о важных изменениях сообщим в приложении.',
      ]],
    ],
  },
  uz: {
    title: 'Maxfiylik siyosati',
    intro: `Ushbu siyosat Vaqtim ilovasi («Vaqtim», «biz») qanday ma’lumot to‘plashi, nima uchun va sizda qanday tanlov borligini tushuntiradi. Savollar: ${mail}.`,
    sections: [
      ['Telefoningizda nima qoladi', [
        'Instagram, YouTube va boshqa tarmoqlarga kirish ma’lumotlari, cookie va parollar. Siz ilova ichida tarmoqning o‘z sahifasida kirasiz; bu ma’lumotlar bizga kelmaydi.',
        'Ijtimoiy tarmoqlarda ko‘rgan, joylagan yoki yuborgan narsalaringiz.',
        'Bloklash uchun tanlangan ilovalar va Screen Time (iPhone) yoki Maxsus imkoniyatlar (Android) ruxsatlari. Android’da Maxsus imkoniyatlar xizmati faqat qaysi ilova ochiqligini tekshirib, Vaqtim ekranini ko‘rsatadi; xabarlar, parollar, yozilgan matn va ekran mazmunini o‘qimaydi.',
      ]],
      ['Biz nima to‘playmiz', [
        '<b>Hisob:</b> elektron pochta manzilingiz, ismingiz va kirish usuli (pochta, Apple, Google yoki Telegram).',
        '<b>Sozlamalar zaxirasi:</b> ilova sozlamalari (masalan, qaysi filtrlar yoqilgan) — yangi telefonda tiklash uchun.',
        '<b>Yordam xabarlari:</b> ilova ichidagi yordam chatiga yozgan xabarlaringiz, hisob pochtasi va ismi, javob haqida xabar berish uchun bildirishnoma tokeni.',
        '<b>Analitika, sessiya yozuvi va xatolik hisobotlari</b> (yoqilgan bo‘lsa): ilova hodisalari, masalan qaysi ekranlarni ochganingiz, haftalik vaqt xulosalari, Vaqtim’ning o‘z ekranlari yozuvi va xatoliklar. Parollar, pochta maydonlari, hisob ekrani va ijtimoiy tarmoq mazmuni yashiriladi. Buni Sozlamalar → Maxfiylik’da o‘chirishingiz mumkin.',
        '<b>Xaridlar</b> (pullik tariflar chiqqanda): Apple yoki Google orqali amalga oshadi. Biz karta ma’lumotini emas, faqat obuna holatini olamiz.',
      ]],
      ['Nima uchun foydalanamiz', [
        'Hisobingizni yuritish, sozlamalarni tiklash, yordam so‘rovlariga javob berish, xatoliklarni tuzatish va ilovani yaxshilash uchun. Biz ma’lumotlaringizni sotmaymiz va reklama ko‘rsatmaymiz.',
      ]],
      ['Xizmat ko‘rsatuvchilar', [
        'Ilova ishlashi uchun ishonchli xizmatlardan foydalanamiz: Supabase (hisoblar, ma’lumotlar bazasi va hosting), PostHog (analitika, sessiya yozuvi va xatolik hisobotlari), Telegram (yordam xabarlarini jamoamizga yetkazish), Expo (push-bildirishnomalar), Apple va Google (kirish, xaridlar va ilovani tarqatish) va RevenueCat (obuna holati). Ular ma’lumotni faqat bizga xizmat ko‘rsatish uchun ishlatadi.',
      ]],
      ['Qancha saqlaymiz', [
        'Hisob ma’lumotlari hisobni o‘chirguningizcha saqlanadi. Analitika cheklangan muddat saqlanadi va so‘rov bo‘yicha o‘chiriladi.',
      ]],
      ['Tanlovingiz va huquqlaringiz', [
        'Analitika va sessiya yozuvini Sozlamalar → Maxfiylik’da o‘chiring.',
        'Hisobni Sozlamalar → Hisob → Hisobni o‘chirish orqali o‘chiring. Bu hisob, sozlamalar zaxirasi, yordam xabarlari va bildirishnoma tokenlarini serverlarimizdan, telefondagi barcha Vaqtim ma’lumotlarini esa telefondan o‘chiradi. <a href="../delete-account/">Hisobni o‘chirish</a> sahifasiga qarang.',
        `Ma’lumotlaringiz nusxasini, ularni tuzatishni yoki analitika yozuvlarini o‘chirishni so‘rang: ${mail}.`,
      ]],
      ['Bolalar', [
        'Vaqtim 13 yoshdan kichik bolalar uchun mo‘ljallanmagan.',
      ]],
      ['O‘zgarishlar', [
        'Siyosatni o‘zgartirsak, quyidagi sanani yangilaymiz, muhim o‘zgarishlar haqida esa ilovada xabar beramiz.',
      ]],
    ],
  },
};

export const terms: Record<Locale, LegalDoc> = {
  en: {
    title: 'Terms of Use',
    intro: `By using the Vaqtim app you agree to these terms. Questions: ${mail}.`,
    sections: [
      ['What Vaqtim is', ['Vaqtim lets you use social networks such as Instagram and YouTube with short-video feeds hidden, and can block the original apps if you choose. Vaqtim is not made, endorsed or affiliated with Meta, Google or any social network.']],
      ['Your account', ['You need a Vaqtim account to use the app. Keep your sign-in details safe and give accurate information. You must be at least 13 years old, or the age required in your country.']],
      ['Social networks', ['When you use a social network inside Vaqtim, its own terms and privacy policy apply to you. Social networks change their websites, so filtering may sometimes miss a section or stop working until we update it.']],
      ['Acceptable use', ['Don’t misuse Vaqtim: don’t try to break, overload or reverse-engineer our services, access other people’s accounts, or use Vaqtim to break the law or a social network’s rules.']],
      ['Paid plans', ['Paid plans, when available, are sold through the App Store or Google Play and renew automatically until cancelled in your store account settings. Prices and trial terms are shown before you buy. Refunds follow the store’s rules.']],
      ['No guarantee', ['Vaqtim is provided “as is”. We work hard to keep it reliable, but we can’t promise it will always be available or remove every short video. To the extent the law allows, we are not liable for indirect losses from using the app.']],
      ['Ending', ['You can stop using Vaqtim and delete your account at any time. We may suspend accounts that break these terms.']],
      ['Changes', ['We may update these terms. If changes are important, we will tell you in the app before they apply.']],
    ],
  },
  ru: {
    title: 'Условия использования',
    intro: `Используя приложение Vaqtim, вы соглашаетесь с этими условиями. Вопросы: ${mail}.`,
    sections: [
      ['Что такое Vaqtim', ['Vaqtim позволяет пользоваться соцсетями, например Instagram и YouTube, со скрытыми лентами коротких видео и по вашему желанию блокировать оригинальные приложения. Vaqtim не создан, не одобрен Meta, Google или другими соцсетями и не связан с ними.']],
      ['Ваш аккаунт', ['Для работы приложения нужен аккаунт Vaqtim. Храните данные входа в безопасности и указывайте верные сведения. Вам должно быть не менее 13 лет или возраст, требуемый в вашей стране.']],
      ['Соцсети', ['Когда вы пользуетесь соцсетью внутри Vaqtim, к вам применяются её собственные условия и политика конфиденциальности. Соцсети меняют свои сайты, поэтому фильтр иногда может пропустить раздел или перестать работать до нашего обновления.']],
      ['Допустимое использование', ['Не злоупотребляйте Vaqtim: не пытайтесь взломать, перегрузить или декомпилировать наши сервисы, получить доступ к чужим аккаунтам или использовать Vaqtim для нарушения закона или правил соцсетей.']],
      ['Платные тарифы', ['Платные тарифы, когда появятся, продаются через App Store или Google Play и продлеваются автоматически, пока вы не отмените их в настройках аккаунта магазина. Цены и условия пробного периода показываются до покупки. Возвраты — по правилам магазина.']],
      ['Без гарантий', ['Vaqtim предоставляется «как есть». Мы стараемся, чтобы он работал надёжно, но не можем обещать, что он всегда будет доступен или уберёт каждое короткое видео. В пределах, разрешённых законом, мы не отвечаем за косвенные убытки от использования приложения.']],
      ['Прекращение', ['Вы можете прекратить пользоваться Vaqtim и удалить аккаунт в любой момент. Мы можем заблокировать аккаунты, нарушающие эти условия.']],
      ['Изменения', ['Мы можем обновлять условия. О важных изменениях мы сообщим в приложении до их вступления в силу.']],
    ],
  },
  uz: {
    title: 'Foydalanish shartlari',
    intro: `Vaqtim ilovasidan foydalanib, siz ushbu shartlarga rozilik bildirasiz. Savollar: ${mail}.`,
    sections: [
      ['Vaqtim nima', ['Vaqtim Instagram va YouTube kabi ijtimoiy tarmoqlardan qisqa video lentalarisiz foydalanish va xohlasangiz asl ilovalarni bloklash imkonini beradi. Vaqtim Meta, Google yoki boshqa tarmoqlar tomonidan yaratilmagan, ma’qullanmagan va ular bilan bog‘liq emas.']],
      ['Hisobingiz', ['Ilovadan foydalanish uchun Vaqtim hisobi kerak. Kirish ma’lumotlaringizni xavfsiz saqlang va to‘g‘ri ma’lumot kiriting. Yoshingiz kamida 13 yoki mamlakatingizda talab qilingan yoshda bo‘lishi kerak.']],
      ['Ijtimoiy tarmoqlar', ['Vaqtim ichida ijtimoiy tarmoqdan foydalanganingizda uning o‘z shartlari va maxfiylik siyosati amal qiladi. Tarmoqlar saytlarini o‘zgartirib turadi, shuning uchun filtr ba’zan biror bo‘limni o‘tkazib yuborishi yoki biz yangilaguncha ishlamay qolishi mumkin.']],
      ['Ruxsat etilgan foydalanish', ['Vaqtim’dan noto‘g‘ri foydalanmang: xizmatlarimizni buzish, ortiqcha yuklash yoki teskari muhandislik qilishga urinmang, boshqalarning hisoblariga kirmang va Vaqtim’dan qonun yoki tarmoq qoidalarini buzish uchun foydalanmang.']],
      ['Pullik tariflar', ['Pullik tariflar chiqqanda App Store yoki Google Play orqali sotiladi va do‘kon hisobi sozlamalarida bekor qilmaguningizcha avtomatik yangilanadi. Narx va sinov muddati xariddan oldin ko‘rsatiladi. Pulni qaytarish do‘kon qoidalariga ko‘ra amalga oshadi.']],
      ['Kafolat yo‘q', ['Vaqtim «boricha» taqdim etiladi. Ishonchli ishlashi uchun harakat qilamiz, lekin u doim mavjud bo‘lishi yoki har bir qisqa videoni olib tashlashiga va’da bera olmaymiz. Qonun ruxsat bergan darajada ilovadan foydalanish bilan bog‘liq bilvosita zararlar uchun javobgar emasmiz.']],
      ['Tugatish', ['Vaqtim’dan foydalanishni to‘xtatib, hisobingizni istalgan vaqtda o‘chirishingiz mumkin. Ushbu shartlarni buzgan hisoblarni to‘xtatishimiz mumkin.']],
      ['O‘zgarishlar', ['Shartlarni yangilashimiz mumkin. Muhim o‘zgarishlar haqida ular kuchga kirishidan oldin ilovada xabar beramiz.']],
    ],
  },
};
