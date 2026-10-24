import { useProfileStore } from '../../../store/profileStore';
import { accountApi } from '../accountSession';
import { cachedDisplayName, loadProfile, rememberProfile } from '../profileCache';

jest.mock('../accountSession', () => {
  const getAccount = jest.fn();
  return { accountApi: () => ({ getAccount }) };
});

const userId = '00000000-0000-0000-0000-000000000001';
const getAccount = jest.mocked(accountApi().getAccount);

describe('saved profile', () => {
  beforeEach(() => { useProfileStore.setState({ profile: null }); getAccount.mockResolvedValue({ id: userId, email: 'a@b.c', profile: { displayName: 'Ali', updatedAt: null } }); });

  it('asks the server once, then answers from the saved copy', async () => {
    await expect(loadProfile(userId)).resolves.toBe('Ali');
    await expect(loadProfile(userId)).resolves.toBe('Ali');
    expect(getAccount).toHaveBeenCalledTimes(1);
    expect(cachedDisplayName(userId)).toBe('Ali');
  });

  it('shares one request between screens opening together', async () => {
    await Promise.all([loadProfile(userId), loadProfile(userId)]);
    expect(getAccount).toHaveBeenCalledTimes(1);
  });

  it('refreshes a day-old copy and never shows another account’s name', async () => {
    useProfileStore.setState({ profile: { userId, displayName: 'Old', fetchedAt: Date.now() - 25 * 60 * 60_000 } });
    await expect(loadProfile(userId)).resolves.toBe('Ali');
    expect(cachedDisplayName('00000000-0000-0000-0000-000000000002')).toBe('');
  });

  it('keeps an edited name without asking again', async () => {
    rememberProfile(userId, 'New name');
    await expect(loadProfile(userId)).resolves.toBe('New name');
    expect(getAccount).not.toHaveBeenCalled();
  });
});
