export const observabilityTranslations = {
  en: {
    title: 'Usage analytics & session replay',
    description: 'When configured, FocusUp sends usage events, device details, approximate location and error reports to PostHog. Session replay records visible app screens, including text and images. Account details, sign-in fields and social website content are masked. Turn this off to stop analytics and replay; local statistics keep working.',
    enabled: 'Share analytics and session replay', unavailable: 'Tracking is inactive in this build because PostHog is not configured.',
    saveFailed: 'Your tracking preference could not be saved. Please try again.',
    error: 'FocusUp could not load this screen.', retry: 'Try again',
    privacy: 'Usage statistics stay on this device. When enabled and configured, PostHog receives app usage events, error reports and masked session recordings. Manage tracking in Privacy. Social website content and sign-in fields are masked from recordings.',
    accountNote: 'Your full activity history and social browsing data stay on this device. Optional analytics and masked session replay are managed in Privacy.',
  },
  ru: {
    title: 'Аналитика и запись сеансов',
    description: 'Если PostHog настроен, FocusUp отправляет события использования, сведения об устройстве, примерное местоположение и отчёты об ошибках. Запись сеансов показывает экраны приложения, включая текст и изображения. Данные аккаунта, поля входа и содержимое социальных сайтов скрыты. Отключите эту настройку, чтобы остановить аналитику и запись; локальная статистика продолжит работать.',
    enabled: 'Делиться аналитикой и записью сеансов', unavailable: 'Отслеживание неактивно: PostHog не настроен в этой сборке.',
    saveFailed: 'Не удалось сохранить настройку. Попробуйте ещё раз.',
    error: 'Не удалось загрузить этот экран FocusUp.', retry: 'Повторить',
    privacy: 'Статистика использования хранится на устройстве. Если аналитика включена и настроена, PostHog получает события приложения, отчёты об ошибках и записи сеансов со скрытыми личными данными. Управлять этим можно в разделе конфиденциальности. Содержимое социальных сайтов и поля входа скрыты в записях.',
    accountNote: 'Полная история активности и данные социальных сайтов остаются на устройстве. Аналитикой и записью сеансов можно управлять в разделе конфиденциальности.',
  },
  uz: {
    title: 'Analitika va seans yozuvlari',
    description: 'PostHog sozlangan bo‘lsa, FocusUp foydalanish hodisalari, qurilma ma’lumotlari, taxminiy joylashuv va xatolik hisobotlarini yuboradi. Seans yozuvi ilova ekranlari, matn va rasmlarni ko‘rsatadi. Hisob ma’lumotlari, kirish maydonlari va ijtimoiy saytlar mazmuni yashiriladi. Buni o‘chirsangiz, analitika va yozuv to‘xtaydi; mahalliy statistika ishlashda davom etadi.',
    enabled: 'Analitika va seans yozuvlarini ulashish', unavailable: 'Bu versiyada PostHog sozlanmagan, kuzatish faol emas.',
    saveFailed: 'Sozlamani saqlab bo‘lmadi. Qayta urinib ko‘ring.',
    error: 'FocusUp bu ekranni yuklay olmadi.', retry: 'Qayta urinish',
    privacy: 'Foydalanish statistikasi qurilmada saqlanadi. Analitika yoqilgan va sozlangan bo‘lsa, PostHog ilova hodisalari, xatolik hisobotlari va maxfiy qismlari yashirilgan seans yozuvlarini oladi. Kuzatishni Maxfiylik bo‘limida boshqaring. Ijtimoiy saytlar mazmuni va kirish maydonlari yozuvlarda yashiriladi.',
    accountNote: 'To‘liq faollik tarixi va ijtimoiy saytlardagi ma’lumotlar qurilmada qoladi. Analitika va seans yozuvlarini Maxfiylik bo‘limida boshqarish mumkin.',
  },
};
