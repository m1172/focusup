import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRemoteBlockerConfigStore, type RemoteBlockerConfig, type RemotePlatformRule } from '../../store/remoteBlockerConfigStore';

const CACHE_KEY = '@focusup/remote-blocker-config-v1';
const MAX_RESPONSE_BYTES = 32_768;
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 4_000;
const MIN_REFRESH_INTERVAL_MS = 15 * 60_000;
const featuresByPlatform = {
  instagram: ['reels', 'explore', 'suggestedPosts', 'recommendations', 'sponsoredPosts', 'homeFeed'],
  youtube: ['shorts', 'homeRecommendations', 'recommendations', 'comments', 'sponsoredContent'],
} as const;
let initialized = false;
let requestInFlight: Promise<void> | null = null;
let lastRequestAt = 0;
let activeController: AbortController | null = null;
let generation = 0;

const selectorRoots: Record<'instagram' | 'youtube', Record<string, string[]>> = {
  instagram: { reels: ['a['], explore: ['a['], suggestedPosts: ['article', '[role="article"]'], recommendations: ['section', '[role="region"]', '[role="group"]'], homeFeed: ['article', '[role="article"]'] },
  youtube: { shortsNavigation: ['a[', 'ytd-guide-entry-renderer', 'ytm-pivot-bar-item-renderer'], shortsShelves: ['ytd-reel-', 'ytm-reel-', 'ytm-shorts-', 'ytd-shorts'], homeRecommendations: ['ytd-rich-grid-renderer', 'ytm-rich-grid-renderer'], recommendations: ['ytd-watch-next-secondary-results-renderer', 'ytm-watch-next-secondary-results-renderer', 'ytd-compact-video-renderer'], comments: ['ytd-comments', 'ytm-comments-entry-point-header-renderer'] },
};
export function isSafeRemoteSelector(platform: 'instagram' | 'youtube', group: string, selector: unknown): selector is string {
  return typeof selector === 'string' && selector.length <= 200 && selectorRoots[platform][group]?.some((root) => selector.startsWith(root)) === true && !/[;{}\\\\`<>*]/.test(selector) && !/:has|:not|input|textarea|password|cookie|contenteditable|javascript|direct|message|\bon[a-z]+\s*=/i.test(selector);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function validateRemoteBlockerConfig(value: unknown): RemoteBlockerConfig | null {
  if (!isObject(value) || !hasOnlyKeys(value, ['schemaVersion', 'platforms']) || value.schemaVersion !== 1 || !isObject(value.platforms)) return null;
  if (!hasOnlyKeys(value.platforms, ['instagram', 'youtube'])) return null;
  const platforms: RemoteBlockerConfig['platforms'] = {};
  for (const platform of ['instagram', 'youtube'] as const) {
    const raw = value.platforms[platform];
    if (raw === undefined) continue;
    if (!isObject(raw) || !hasOnlyKeys(raw, ['version', 'enabled', 'features', 'selectors', 'routes']) || !Number.isInteger(raw.version) || (raw.version as number) < 1 || (raw.version as number) > 100_000 || typeof raw.enabled !== 'boolean' || !isObject(raw.features) || !hasOnlyKeys(raw.features, [...featuresByPlatform[platform]])) return null;
    const features: Record<string, boolean> = {};
    for (const [feature, enabled] of Object.entries(raw.features)) {
      if (typeof enabled !== 'boolean') return null;
      features[feature] = enabled;
    }
    const selectors: Record<string, string[]> = {};
    if (raw.selectors !== undefined) {
      if (!isObject(raw.selectors) || !hasOnlyKeys(raw.selectors, Object.keys(selectorRoots[platform]))) return null;
      for (const [group, values] of Object.entries(raw.selectors)) { if (!Array.isArray(values) || values.length > 12 || !values.every((selector) => isSafeRemoteSelector(platform, group, selector))) return null; selectors[group] = values; }
    }
    let routes: string[] | undefined;
    if (raw.routes !== undefined) {
      if (!Array.isArray(raw.routes) || raw.routes.length > 12 || !raw.routes.every((route) => typeof route === 'string' && (platform === 'instagram' ? /^\/(?:reels?|explore\/reels)(?:\/[a-z_-]+)?\/?$/ : /^\/(?:shorts|feed\/shorts)(?:\/[a-z_-]+)?\/?$/).test(route))) return null;
      routes = raw.routes;
    }
    platforms[platform] = { version: raw.version as number, enabled: raw.enabled, features, ...(raw.selectors ? { selectors } : {}), ...(routes ? { routes } : {}) } as RemotePlatformRule;
  }
  return { schemaVersion: 1, platforms };
}

function parseCachedConfig(raw: string | null): { config: RemoteBlockerConfig; fetchedAt: number } | null {
  if (!raw || raw.length > MAX_RESPONSE_BYTES * 2) return null;
  try {
    const cached = JSON.parse(raw) as unknown;
    if (!isObject(cached) || !hasOnlyKeys(cached, ['config', 'fetchedAt']) || typeof cached.fetchedAt !== 'number') return null;
    const config = validateRemoteBlockerConfig(cached.config);
    return config ? { config, fetchedAt: cached.fetchedAt } : null;
  } catch { return null; }
}

export async function initializeRemoteBlockerConfig(): Promise<void> {
  if (initialized) return refreshRemoteBlockerConfig();
  initialized = true;
  try {
    const cached = parseCachedConfig(await AsyncStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.fetchedAt <= CACHE_MAX_AGE_MS) {
      useRemoteBlockerConfigStore.getState().setConfig(cached.config, 'cache');
      // A copy fetched within the refresh interval (e.g. before a quick restart) is current; skip the request.
      if (cached.fetchedAt <= Date.now()) lastRequestAt = cached.fetchedAt;
    }
  } catch { /* Bundled rules remain available when local cache is unreadable. */ }
  await refreshRemoteBlockerConfig();
}

export function refreshRemoteBlockerConfig(): Promise<void> {
  if (requestInFlight) return requestInFlight;
  const endpoint = process.env.EXPO_PUBLIC_BLOCKER_CONFIG_URL;
  const now = Date.now();
  if (!endpoint || now - lastRequestAt < MIN_REFRESH_INTERVAL_MS) return Promise.resolve();
  try { if (new URL(endpoint).protocol !== 'https:') return Promise.resolve(); } catch { return Promise.resolve(); }
  lastRequestAt = now;
  const requestedGeneration = generation;
  requestInFlight = (async () => {
    const controller = new AbortController();
    activeController = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) return;
      const body = await response.text();
      if (body.length > MAX_RESPONSE_BYTES) return;
      let decoded: unknown;
      try { decoded = JSON.parse(body); } catch { return; }
      const config = validateRemoteBlockerConfig(decoded);
      if (!config || requestedGeneration !== generation) return;
      useRemoteBlockerConfigStore.getState().setConfig(config, 'remote');
      try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ config, fetchedAt: Date.now() })); } catch { /* Valid network rules can still be used for this run. */ }
    } catch { /* Offline mode keeps the last valid cached/bundled configuration. */ }
    finally { clearTimeout(timer); if (activeController === controller) { activeController = null; requestInFlight = null; } }
  })();
  return requestInFlight;
}

export function getBlockerRuleVersion(platform: 'instagram' | 'youtube'): number | null {
  return useRemoteBlockerConfigStore.getState().config.platforms[platform]?.version ?? null;
}
export function resetRemoteBlockerConfig() {
  generation += 1; activeController?.abort(); activeController = null; requestInFlight = null; lastRequestAt = 0; initialized = false;
}
