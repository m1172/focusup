import { useAppStore } from '../appStore';

jest.mock('../../config/release', () => ({ PRO_ENABLED: true }));

describe('local preferences store', () => {
  it('updates per-app enablement and filter preferences', () => {
    useAppStore.getState().setAppEnabled('instagram', false);
    useAppStore.getState().setFilter('instagram', 'reels', false);
    expect(useAppStore.getState().apps.instagram.enabled).toBe(false);
    expect(useAppStore.getState().apps.instagram.filters.reels).toBe(false);
  });

  it('locks an app configuration for the duration of a strict session', () => {
    useAppStore.setState({
      strictSession: {
        endsAt: Date.now() + 60_000,
        appIds: ['instagram'],
        filters: { instagram: { reels: true } },
      },
    });
    const before = useAppStore.getState().apps.instagram;
    useAppStore.getState().setAppEnabled('instagram', false);
    useAppStore.getState().setFilter('instagram', 'reels', false);
    expect(useAppStore.getState().apps.instagram).toEqual(before);
    useAppStore.setState({ strictSession: null });
  });

  it('switches blocking on and off, but never off during a strict session', () => {
    useAppStore.getState().setBlocking('tiktok', 'blockWebsite', true);
    expect(useAppStore.getState().apps.tiktok.blockWebsite).toBe(true);
    useAppStore.setState({ strictSession: { endsAt: Date.now() + 60_000, appIds: ['tiktok'], filters: {} } });
    useAppStore.getState().setBlocking('tiktok', 'blockWebsite', false);
    expect(useAppStore.getState().apps.tiktok.blockWebsite).toBe(true);
    useAppStore.setState({ strictSession: null });
    useAppStore.getState().setBlocking('tiktok', 'blockWebsite', false);
    expect(useAppStore.getState().apps.tiktok.blockWebsite).toBe(false);
  });

  it('keeps the original app blocked after upgrading when its short-video filter was on', () => {
    const migrate = useAppStore.persist.getOptions().migrate!;
    const migrated = migrate({ apps: {
      instagram: { enabled: true, filters: { reels: true } },
      youtube: { enabled: true, filters: { shorts: false } },
      tiktok: { enabled: false, filters: { forYou: true } },
    } }, 4) as { apps: Record<string, { blockNativeApp?: boolean; blockWebsite?: boolean; filters: Record<string, boolean> }> };
    expect(migrated.apps.instagram.blockNativeApp).toBe(true);
    expect(migrated.apps.youtube.blockNativeApp).toBe(false);
    expect(migrated.apps.tiktok.blockNativeApp).toBe(false);
    expect(migrated.apps.instagram.blockWebsite).toBe(false);
    expect(migrated.apps.tiktok.filters).toEqual({ forYou: true, following: true, explore: false });
  });
});
