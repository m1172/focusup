import * as SecureStore from 'expo-secure-store';
import { protectionBridge } from '../protection/nativeBridge';
import { useInstagramAccountsStore, type InstagramAccountSlot } from '../../store/instagramAccountsStore';

/**
 * Vaqtim's Instagram account switcher. Instagram's website keeps one sign-in at a time, so each account's
 * sign-in cookies are saved in the secure store and swapped back in when the user switches.
 */
export const MAX_INSTAGRAM_ACCOUNTS = 5;
export const INSTAGRAM_HOME = 'https://www.instagram.com/';
export const INSTAGRAM_LOGIN = 'https://www.instagram.com/accounts/login/';
const DOMAIN = 'instagram.com';
/** Some iOS versions refuse keychain values above about 2 KB, so a saved sign-in is split into pieces. */
const CHUNK = 1800;
const MAX_CHUNKS = 40;
/** Instagram renews its cookies; the active account's copy is refreshed at most this often. */
const RESAVE_MS = 60_000;

const secureOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
let operations: Promise<unknown> = Promise.resolve();
let generation = 0;
function serial<T>(operation: () => Promise<T>): Promise<T> { const next = operations.then(operation); operations = next.catch(() => undefined); return next; }
const accountIdentity = (json: string): string | null => { try { const cookies = JSON.parse(json) as Cookie[]; const id = cookies.find(c => c.name === 'ds_user_id')?.value; return id && /^\d+$/.test(id) ? id : null; } catch { return null; } };
const key = (id: string, part: string | number) => `vaqtim.instagram.${id}.${part}`;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const store = () => useInstagramAccountsStore.getState();

type Cookie = { name: string; value: string; domain: string };
const signedIn = (json: string) => {
  try { return (JSON.parse(json) as Cookie[]).some((cookie) => cookie.name === 'sessionid' && cookie.value.length > 0); } catch { return false; }
};

async function writeSession(id: string, json: string) {
  json = JSON.stringify({ version: 2, cookies: json });
  const parts = Math.ceil(json.length / CHUNK);
  if (parts > MAX_CHUNKS) throw new Error('sessionTooLarge');
  for (let index = 0; index < parts; index++) await SecureStore.setItemAsync(key(id, index), json.slice(index * CHUNK, (index + 1) * CHUNK), secureOptions);
  const previous = Number(await SecureStore.getItemAsync(key(id, 'n'))) || 0;
  await SecureStore.setItemAsync(key(id, 'n'), String(parts), secureOptions);
  for (let index = parts; index < previous; index++) await SecureStore.deleteItemAsync(key(id, index));
}
async function readSession(id: string): Promise<string | null> {
  const parts = Number(await SecureStore.getItemAsync(key(id, 'n'))) || 0;
  if (!parts || parts > MAX_CHUNKS) return null;
  let json = '';
  for (let index = 0; index < parts; index++) {
    const piece = await SecureStore.getItemAsync(key(id, index));
    if (piece === null) return null;
    json += piece;
  }
  try { const saved = JSON.parse(json); return saved.version === 2 && typeof saved.cookies === 'string' ? saved.cookies : null; } catch { return null; }
}
async function deleteSession(id: string) {
  const parts = Number(await SecureStore.getItemAsync(key(id, 'n'))) || 0;
  for (let index = 0; index < Math.min(parts, MAX_CHUNKS); index++) await SecureStore.deleteItemAsync(key(id, index));
  await SecureStore.deleteItemAsync(key(id, 'n'));
}

function update(id: string, change: Partial<InstagramAccountSlot>) {
  const { slots, activeId } = store();
  store().setSlots(slots.map((slot) => slot.id === id ? { ...slot, ...change } : slot), activeId);
}

export const canSwitchInstagramAccounts = () => protectionBridge.canSwitchAccounts();

/** Saves the browser's current Instagram sign-in into the active account. Returns false when nobody is signed in. */
async function saveActiveInstagramSessionInternal(): Promise<boolean> {
  const { activeId } = store();
  if (!activeId || !canSwitchInstagramAccounts()) return false;
  const json = await protectionBridge.getSiteCookies(DOMAIN);
  if (!signedIn(json) || !accountIdentity(json) || store().slots.find(slot => slot.id === activeId)?.accountId !== accountIdentity(json)) return false;
  await writeSession(activeId, json);
  update(activeId, { savedAt: Date.now() });
  return true;
}

/** The page reported who is signed in: keep the account list in step and refresh the saved sign-in. */
export function saveActiveInstagramSession() { return serial(saveActiveInstagramSessionInternal); }
export function instagramAccountDetected(username: string, avatar: string, now = Date.now()) {
  const expected = generation;
  return serial(async () => {
    if (expected !== generation || !canSwitchInstagramAccounts()) return;
    const json = await protectionBridge.getSiteCookies(DOMAIN);
    const accountId = accountIdentity(json);
    if (!accountId || !signedIn(json)) return;
    const { slots, activeId } = store();
    const existing = slots.find(slot => slot.accountId === accountId);
    const pending = slots.find(slot => slot.id === activeId && !slot.username && !slot.accountId);
    const selected = existing ?? pending;
    if (!selected && slots.length >= MAX_INSTAGRAM_ACCOUNTS) return;
    const slot = { ...(selected ?? { id: newId(), savedAt: 0 }), accountId, username, avatar };
    const next = selected ? slots.map(item => item.id === selected.id ? slot : item) : [...slots, slot];
    store().setSlots(existing && pending && pending.id !== existing.id ? next.filter(item => item.id !== pending.id) : next, slot.id);
    if (now - slot.savedAt >= RESAVE_MS) await saveActiveInstagramSessionInternal();
  });
}

/** Signs the browser in to another saved account. The caller reloads Instagram afterwards. */
async function switchInstagramAccountInternal(id: string): Promise<boolean> {
  const { slots, activeId } = store();
  if (id === activeId || !slots.some((slot) => slot.id === id)) return false;
  const saved = await readSession(id);
  if (!saved || !canSwitchInstagramAccounts() || accountIdentity(saved) !== slots.find(slot => slot.id === id)?.accountId) return false;
  const leaving = slots.find((slot) => slot.id === activeId);
  const kept = await saveActiveInstagramSessionInternal().catch(() => false);
  await protectionBridge.clearSiteData(DOMAIN);
  if (!await protectionBridge.setSiteCookies(DOMAIN, saved)) throw new Error('cookieRestoreFailed');
  // An account that was being added but never finished signing in is dropped.
  const remaining = leaving && !leaving.username && !kept ? store().slots.filter((slot) => slot.id !== leaving.id) : store().slots;
  store().setSlots(remaining, id);
  return true;
}

/** Keeps the current sign-in, signs the browser out and adds a new account. The caller opens the login page. */
async function addInstagramAccountInternal(): Promise<boolean> {
  const { slots, activeId } = store();
  if (slots.length >= MAX_INSTAGRAM_ACCOUNTS || !canSwitchInstagramAccounts()) return false;
  const pending = slots.find((slot) => !slot.username);
  if (pending && pending.id === activeId) return true;
  await saveActiveInstagramSessionInternal().catch(() => false);
  await protectionBridge.clearSiteData(DOMAIN);
  const slot = pending ?? { id: newId(), username: '', avatar: '', savedAt: 0 };
  store().setSlots(pending ? store().slots : [...store().slots, slot], slot.id);
  return true;
}

/** Forgets an account that is not in use: its saved sign-in is deleted from this phone. */
async function removeInstagramAccountInternal(id: string): Promise<boolean> {
  const { slots, activeId } = store();
  if (id === activeId || !slots.some((slot) => slot.id === id)) return false;
  await deleteSession(id);
  store().setSlots(store().slots.filter((slot) => slot.id !== id), store().activeId);
  return true;
}

export function switchInstagramAccount(id: string) { generation++; return serial(() => switchInstagramAccountInternal(id)); }
export function addInstagramAccount() { generation++; return serial(addInstagramAccountInternal); }
export function removeInstagramAccount(id: string) { generation++; return serial(() => removeInstagramAccountInternal(id)); }
