import { buildNativePlan, createTemporaryAccess, localDayKey, POSTS_PER_DAY, postsLeft, protectionReason } from '../engine';
import { defaultSleepPlan } from '../../../store/wellbeingStore';

jest.mock('../../../config/release', () => ({ PRO_ENABLED: false }));

const now = new Date(2026, 10, 9, 15, 0);
const free = { baseline: [], filterBlocked: ['instagram' as const], routines: [], sleep: defaultSleepPlan, strict: null, temporary: null, isPro: false };

describe('Post mode', () => {
  it('opens the real app for everyone, while a break still needs Pro', () => {
    const post = createTemporaryAccess('instagram', 10, 1, now.getTime(), 'post');
    expect(protectionReason('instagram', { ...free, temporary: post }, now)).toBe('temporary');
    expect(buildNativePlan({ ...free, temporary: post }).temporary).toEqual(post);
    const brk = createTemporaryAccess('instagram', 10, 1, now.getTime());
    expect(protectionReason('instagram', { ...free, temporary: brk }, now)).toBe('protected');
    expect(buildNativePlan({ ...free, temporary: brk }).temporary).toBeNull();
  });

  it('ends when its time is up', () => {
    const post = createTemporaryAccess('instagram', 10, 1, now.getTime(), 'post');
    expect(protectionReason('instagram', { ...free, temporary: post }, new Date(post.endsAt))).toBe('protected');
  });

  it('allows a few a day and starts again the next day', () => {
    expect(postsLeft({ day: '', count: 0 }, now)).toBe(POSTS_PER_DAY);
    expect(postsLeft({ day: localDayKey(now), count: POSTS_PER_DAY }, now)).toBe(0);
    expect(postsLeft({ day: localDayKey(now), count: POSTS_PER_DAY }, new Date(2026, 10, 10, 9))).toBe(POSTS_PER_DAY);
  });
});
