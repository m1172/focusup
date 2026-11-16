import { billingTranslations } from '../../../translations/billing';
import { ANDROID_PACKAGE, manageSubscriptionUrl } from '../manage';

test('the manage link opens the store that sold the subscription, on that platform only', () => {
  expect(ANDROID_PACKAGE).toBe(require('../../../../app.json').expo.android.package);
  expect(manageSubscriptionUrl({ store: 'ios', productId: 'focusup_pro_annual' }, 'ios')).toBe('https://apps.apple.com/account/subscriptions');
  expect(manageSubscriptionUrl({ store: 'android', productId: 'focusup_family:annual' }, 'android'))
    .toBe('https://play.google.com/store/account/subscriptions?sku=focusup_family&package=com.m1172.focusup');
  expect(manageSubscriptionUrl({ store: 'android', productId: null }, 'android')).toBe('https://play.google.com/store/account/subscriptions');
  // Bought on the other platform: no link, so an iPhone never opens Google Play and the reverse.
  expect(manageSubscriptionUrl({ store: 'android', productId: 'focusup_pro:monthly' }, 'ios')).toBeNull();
  expect(manageSubscriptionUrl({ store: 'ios', productId: 'focusup_pro_monthly' }, 'android')).toBeNull();
  expect(manageSubscriptionUrl({ store: null, productId: null }, 'ios')).toBeNull();
  expect(manageSubscriptionUrl(null, 'android')).toBeNull();
});

test('paywall text names only the store of the phone it is shown on (Apple guideline 2.3.10)', () => {
  const apple = /apple|app store|iphone|ios/i, google = /google|android|play/i;
  for (const lang of ['uz', 'ru', 'en'] as const) {
    const text = billingTranslations[lang];
    expect(text.renewIos).toMatch(/apple/i);
    expect(text.renewIos).not.toMatch(google);
    expect(text.renewAndroid).toMatch(/google play/i);
    expect(text.renewAndroid).not.toMatch(apple);
    // Shown on both platforms: no store or platform names at all.
    for (const key of ['otherStore', 'freeNote', 'deleteNotice', 'changeSubmitted', 'ownership', 'activating'] as const) {
      expect(text[key]).not.toMatch(apple);
      expect(text[key]).not.toMatch(google);
    }
    // The price line carries the plan name and the store's price string.
    for (const key of ['billedMonthly', 'billedAnnual'] as const) {
      expect(text[key]).toContain('{{name}}');
      expect(text[key]).toContain('{{price}}');
    }
  }
});
