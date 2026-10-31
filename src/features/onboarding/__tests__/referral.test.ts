import { cleanReferralCode } from '../referral';

test('keeps letters, digits and dashes, upper-cased and capped', () => {
  expect(cleanReferralCode(' vaqt-2026 ')).toBe('VAQT-2026');
  expect(cleanReferralCode('ab c!@#d')).toBe('ABCD');
  expect(cleanReferralCode('x'.repeat(40))).toHaveLength(24);
});
