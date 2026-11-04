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

const key = (id: string, part: string | number) => `vaqtim.instagram.${id}.${part}`;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const store = () => useInstagramAccountsStore.getState();

type Cookie = { name: string; value: string; domain: string };
const signedIn = (json: string) => {
  try { return (JSON.parse(json) as Cookie[]).some((cookie) => cookie.name === 'sessionid' && cookie.value.length > 0); } catch { return false; }
};

async function writeSession(id: string, json: string) {
  const parts = Math.ceil(json.length / CHUNK);
  if (parts > MAX_CHUNKS) throw new Error('sessionTooLarge');
  for (let index = 0; index < parts; index++) await SecureStore.setItemAsync(key(id, index), json.slice(index * CHUNK, (index + 1) * CHUNK));
  const previous = Number(await SecureStore.getItemAsync(key(id, 'n'))) || 0;
  await SecureStore.setItemAsync(key(id, 'n'), String(parts));
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
  return json;
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
export async function saveActiveInstagramSession(): Promise<boolean> {
  const { activeId } = store();
  if (!activeId || !canSwitchInstagramAccounts()) return false;
  const json = await protectionBridge.getSiteCookies(DOMAIN);
  if (!signedIn(json)) return false;
  await writeSession(activeId, json);
  update(activeId, { savedAt: Date.now() });
  return true;
}

/** The page reported who is signed in: keep the account list in step and refresh the saved sign-in. */
export async function instagramAccountDetected(username: string, avatar: string, now = Date.now()) {
  const { slots, activeId } = store();
  const active = slots.find((slot) => slot.id === activeId);
  const existing = slots.find((slot) => slot.username.toLowerCase() === username.toLowerCase());
  let next = slots;
  let nextActive = activeId;
  if (active && active.username.toLowerCase() === username.toLowerCase()) {
    next = slots.map((slot) => slot.id === active.id ? { ...slot, username, avatar: avatar || slot.avatar } : slot);
  } else if (existing) {
    // Signed in to an account that is already on the list (e.g. through Instagram's own login): use that one.
    next = slots.filter((slot) => !(active && slot.id === active.id && !active.username)).map((slot) => slot.id === existing.id ? { ...slot, avatar: avatar || slot.avatar } : slot);
    nextActive = existing.id;
  } else if (active && !active.username) {
    // The account the user just added has finished signing in.
    next = slots.map((slot) => slot.id === active.id ? { ...slot, username, avatar } : slot);
  } else if (slots.length < MAX_INSTAGRAM_ACCOUNTS) {
    const slot = { id: newId(), username, avatar, savedAt: 0 };
    next = [...slots, slot];
    nextActive = slot.id;
  } else if (active) {
    next = slots.map((slot) => slot.id === active.id ? { ...slot, username, avatar, savedAt: 0 } : slot);
  }
  store().setSlots(next, nextActive);
  const current = next.find((slot) => slot.id === nextActive);
  if (current && now - current.savedAt >= RESAVE_MS) await saveActiveInstagramSession().catch(() => false);
}

/** Signs the browser in to another saved account. The caller reloads Instagram afterwards. */
export async function switchInstagramAccount(id: string): Promise<boolean> {
  const { slots, activeId } = store();
  if (id === activeId || !slots.some((slot) => slot.id === id)) return false;
  const saved = await readSession(id);
  if (!saved) return false;
  const leaving = slots.find((slot) => slot.id === activeId);
  const kept = await saveActiveInstagramSession().catch(() => false);
  await protectionBridge.clearSiteData(DOMAIN);
  await protectionBridge.setSiteCookies(DOMAIN, saved);
  // An account that was being added but never finished signing in is dropped.
  const remaining = leaving && !leaving.username && !kept ? store().slots.filter((slot) => slot.id !== leaving.id) : store().slots;
  store().setSlots(remaining, id);
  return true;
}

/** Keeps the current sign-in, signs the browser out and adds a new account. The caller opens the login page. */
export async function addInstagramAccount(): Promise<boolean> {
  const { slots, activeId } = store();
  if (slots.length >= MAX_INSTAGRAM_ACCOUNTS || !canSwitchInstagramAccounts()) return false;
  const pending = slots.find((slot) => !slot.username);
  if (pending && pending.id === activeId) return true;
  await saveActiveInstagramSession().catch(() => false);
  await protectionBridge.clearSiteData(DOMAIN);
  const slot = pending ?? { id: newId(), username: '', avatar: '', savedAt: 0 };
  store().setSlots(pending ? store().slots : [...store().slots, slot], slot.id);
  return true;
}

/** Forgets an account that is not in use: its saved sign-in is deleted from this phone. */
export async function removeInstagramAccount(id: string): Promise<boolean> {
  const { slots, activeId } = store();
  if (id === activeId || !slots.some((slot) => slot.id === id)) return false;
  await deleteSession(id);
  store().setSlots(store().slots.filter((slot) => slot.id !== id), store().activeId);
  return true;
}
