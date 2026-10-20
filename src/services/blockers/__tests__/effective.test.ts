import { getEffectiveAppConfig } from '../effective';
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
      apps: { ...apps, instagram: { enabled: true, filters: { reels: true, explore: true, sponsoredPosts: true } }, youtube: { enabled: true, filters: { shorts: true } } },
      schedules: [], strictSession: null,
    });
    useRemoteBlockerConfigStore.setState({ config: { schemaVersion: 1, platforms: {} } });
  });

  it('keeps Reels protection free while disabling saved Pro filters', () => {
    expect(getEffectiveAppConfig('instagram')).toEqual({ enabled: true, filters: { reels: true, explore: false, sponsoredPosts: false } });
    expect(getEffectiveAppConfig('youtube')).toEqual({ enabled: true, filters: { shorts: true } });
  });

  it('restores saved Instagram preferences for an active Pro subscription', () => {
    setPro(true);
    expect(getEffectiveAppConfig('instagram')).toEqual({ enabled: true, filters: { reels: true, explore: true, sponsoredPosts: true } });
    useAppStore.getState().setAppEnabled('instagram', false);
    expect(getEffectiveAppConfig('instagram').enabled).toBe(false);
  });

  it('removes Pro behavior on downgrade without deleting user preferences', () => {
    setPro(true);
    expect(getEffectiveAppConfig('instagram').enabled).toBe(true);
    setPro(false);
    expect(getEffectiveAppConfig('instagram')).toEqual({ enabled: true, filters: { reels: true, explore: false, sponsoredPosts: false } });
    expect(useAppStore.getState().apps.instagram).toEqual({ enabled: true, filters: { reels: true, explore: true, sponsoredPosts: true } });
  });
});
