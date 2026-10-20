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
});
