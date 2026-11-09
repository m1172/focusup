import { getEffectiveAppConfig, isFilterAdjustable } from '../effective';
import { useAppStore } from '../../../store/appStore';
import { useSubscriptionStore } from '../../../store/subscriptionStore';
import { useRemoteBlockerConfigStore } from '../../../store/remoteBlockerConfigStore';

jest.mock('../../../config/release', () => ({ PRO_ENABLED: true }));

jest.mock('../../../store/subscriptionStore', () => ({ useSubscriptionStore: { getState: jest.fn() } }));

describe('Instagram Clean Mode entitlement', () => {
  const setPro = (isPro: boolean) => jest.mocked(useSubscriptionStore.getState).mockReturnValue({ isPro } as ReturnType<typeof useSubscriptionStore.getState>);

  beforeEach(() => {
    setPro(false);
    const apps = useAppStore.getState().apps;
    useAppStore.setState({
      apps: { ...apps, instagram: { enabled: true, filters: { reels: true, explore: true, sponsoredPosts: true } }, youtube: { enabled: true, filters: { shorts: true, comments: true } } },
      schedules: [], strictSession: null,
    });
    useRemoteBlockerConfigStore.setState({ config: { schemaVersion: 1, platforms: {} } });
  });

  it('keeps Reels protection and the free filters while disabling saved Pro filters', () => {
    expect(getEffectiveAppConfig('instagram')).toEqual({ enabled: true, blocking: true, filters: { reels: true, explore: true, sponsoredPosts: true } });
    expect(getEffectiveAppConfig('youtube')).toEqual({ enabled: true, blocking: true, filters: { shorts: true, comments: false } });
  });

  it('keeps short-video feeds blocked when remote rules pause a platform or feature', () => {
    useRemoteBlockerConfigStore.setState({ config: { schemaVersion: 1, platforms: { instagram: { enabled: false, features: {} }, youtube: { enabled: true, features: { shorts: false } } } } as never });
    expect(getEffectiveAppConfig('instagram').filters.reels).toBe(true);
    expect(getEffectiveAppConfig('instagram').filters.explore).toBe(false);
    expect(getEffectiveAppConfig('youtube').filters.shorts).toBe(true);
  });

  it('offers only filters the user can really change', () => {
    // Free: the short-video feed is always blocked and Pro filters do nothing, so neither is offered.
    expect(isFilterAdjustable('instagram', 'reels', false)).toBe(false);
    expect(isFilterAdjustable('youtube', 'comments', false)).toBe(false);
    expect(isFilterAdjustable('instagram', 'explore', false)).toBe(true);
    expect(isFilterAdjustable('youtube', 'explore', false)).toBe(true);
    expect(isFilterAdjustable('youtube', 'comments', true)).toBe(true);
    expect(isFilterAdjustable('instagram', 'reels', true)).toBe(true);
  });

  it('restores saved Instagram preferences for an active Pro subscription', () => {
    setPro(true);
    expect(getEffectiveAppConfig('instagram')).toEqual({ enabled: true, blocking: true, filters: { reels: true, explore: true, sponsoredPosts: true } });
    useAppStore.getState().setAppEnabled('instagram', false);
    expect(getEffectiveAppConfig('instagram').enabled).toBe(false);
  });

  it('removes Pro behavior on downgrade without deleting user preferences', () => {
    setPro(true);
    expect(getEffectiveAppConfig('instagram').enabled).toBe(true);
    setPro(false);
    expect(getEffectiveAppConfig('youtube').filters.comments).toBe(false);
    expect(useAppStore.getState().apps.youtube.filters.comments).toBe(true);
    expect(useAppStore.getState().apps.instagram).toEqual({ enabled: true, filters: { reels: true, explore: true, sponsoredPosts: true } });
  });

  it('blocks the short-video feed for apps not added to Vaqtim, and only that', () => {
    setPro(true);
    useAppStore.getState().setAppEnabled('instagram', false);
    expect(getEffectiveAppConfig('instagram')).toEqual({ enabled: false, blocking: true, filters: { reels: true } });
  });

  it('keeps the short-video feed blocked for free users who turned it off', () => {
    useAppStore.getState().setFilter('youtube', 'shorts', false);
    expect(getEffectiveAppConfig('youtube').filters.shorts).toBe(true);
    setPro(true);
    expect(getEffectiveAppConfig('youtube').filters.shorts).toBe(false);
  });
});
