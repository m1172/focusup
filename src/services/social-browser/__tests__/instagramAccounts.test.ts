import { useInstagramAccountsStore } from '../../../store/instagramAccountsStore';
import { addInstagramAccount, instagramAccountDetected, MAX_INSTAGRAM_ACCOUNTS, removeInstagramAccount, switchInstagramAccount } from '../instagramAccounts';

const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => { if (value.length > 2048) throw new Error('too large'); mockSecure.set(key, value); }),
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => { mockSecure.delete(key); }),
}));

/** The browser's Instagram cookies, as the native module would hold them. */
let mockCookies = '[]';
jest.mock('../../protection/nativeBridge', () => ({
  protectionBridge: {
    canSwitchAccounts: () => true,
    getSiteCookies: jest.fn(async () => mockCookies),
    setSiteCookies: jest.fn(async (_domain: string, json: string) => { mockCookies = json; return true; }),
    clearSiteData: jest.fn(async () => { mockCookies = '[]'; return true; }),
  },
}));

const session = (user: string) => JSON.stringify([
  { name: 'sessionid', value: `${user}-session-${'x'.repeat(3000)}`, domain: '.instagram.com', path: '/', mockSecure: true, httpOnly: true },
  { name: 'csrftoken', value: `${user}-csrf`, domain: '.instagram.com', path: '/', mockSecure: true, httpOnly: false },
]);
const state = () => useInstagramAccountsStore.getState();
const usernames = () => state().slots.map((slot) => slot.username);
const active = () => state().slots.find((slot) => slot.id === state().activeId);

describe('Instagram account switcher', () => {
  beforeEach(() => { mockSecure.clear(); mockCookies = '[]'; useInstagramAccountsStore.setState({ slots: [], activeId: null }); });

  it('adds the signed-in account and saves its sign-in in keychain-sized pieces', async () => {
    mockCookies = session('alice');
    await instagramAccountDetected('alice', '');
    expect(usernames()).toEqual(['alice']);
    expect(active()?.username).toBe('alice');
    expect(Number(mockSecure.get(`vaqtim.instagram.${state().activeId}.n`))).toBeGreaterThan(1);
    expect([...mockSecure.values()].every((value) => value.length <= 2048)).toBe(true);
  });

  it('adds a second account, then switches back with the first account’s own sign-in', async () => {
    mockCookies = session('alice');
    await instagramAccountDetected('alice', '');
    const alice = state().activeId!;

    expect(await addInstagramAccount()).toBe(true);
    expect(mockCookies).toBe('[]');
    expect(usernames()).toEqual(['alice', '']);

    mockCookies = session('bob');
    await instagramAccountDetected('bob', '');
    expect(usernames()).toEqual(['alice', 'bob']);
    expect(active()?.username).toBe('bob');

    expect(await switchInstagramAccount(alice)).toBe(true);
    expect(mockCookies).toBe(session('alice'));
    expect(active()?.username).toBe('alice');

    // Bob's sign-in was kept when leaving, so switching back restores it too.
    expect(await switchInstagramAccount(state().slots[1]!.id)).toBe(true);
    expect(mockCookies).toBe(session('bob'));
  });

  it('drops an account that was added but never signed in when switching away', async () => {
    mockCookies = session('alice');
    await instagramAccountDetected('alice', '');
    const alice = state().activeId!;
    await addInstagramAccount();
    expect(await switchInstagramAccount(alice)).toBe(true);
    expect(usernames()).toEqual(['alice']);
  });

  it('uses the existing entry when Instagram’s own login signs in to a known account', async () => {
    mockCookies = session('alice');
    await instagramAccountDetected('alice', '');
    await addInstagramAccount();
    mockCookies = session('alice');
    await instagramAccountDetected('alice', '');
    expect(usernames()).toEqual(['alice']);
  });

  it('never switches to an account without a saved sign-in, and never removes the active one', async () => {
    useInstagramAccountsStore.setState({ slots: [{ id: 'a', username: 'alice', avatar: '', savedAt: 0 }, { id: 'b', username: 'bob', avatar: '', savedAt: 0 }], activeId: 'a' });
    expect(await switchInstagramAccount('b')).toBe(false);
    expect(state().activeId).toBe('a');
    expect(await removeInstagramAccount('a')).toBe(false);
    expect(await removeInstagramAccount('b')).toBe(true);
    expect(usernames()).toEqual(['alice']);
  });

  it(`stops at ${MAX_INSTAGRAM_ACCOUNTS} accounts`, async () => {
    useInstagramAccountsStore.setState({ slots: Array.from({ length: MAX_INSTAGRAM_ACCOUNTS }, (_, index) => ({ id: String(index), username: `user${index}`, avatar: '', savedAt: 0 })), activeId: '0' });
    expect(await addInstagramAccount()).toBe(false);
  });
});
