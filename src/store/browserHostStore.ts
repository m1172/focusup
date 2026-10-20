import { create } from 'zustand';
import type { SocialAppId } from '../types/app';

/** A WebView kept alive by the root browser layer. `generation` changes force a fresh mount. */
export type KeptBrowser = { initialUrl?: string; generation: number; hiddenSince: number | null };

type BrowserHostState = {
  browsers: Partial<Record<SocialAppId, KeptBrowser>>;
  /** iOS hides the status bar per screen, so the visible browser publishes its chrome state for the route. */
  statusBarHidden: boolean;
  keep: (appId: SocialAppId, initialUrl?: string) => void;
  setHidden: (appId: SocialAppId, hidden: boolean) => void;
  release: (appId: SocialAppId) => void;
  releaseAll: () => void;
  setStatusBarHidden: (hidden: boolean) => void;
};

let generation = 0;

export const useBrowserHostStore = create<BrowserHostState>((set) => ({
  browsers: {},
  statusBarHidden: true,
  keep: (appId, initialUrl) => set((state) => state.browsers[appId] ? state : { browsers: { ...state.browsers, [appId]: { initialUrl, generation: ++generation, hiddenSince: null } } }),
  setHidden: (appId, hidden) => set((state) => {
    const browser = state.browsers[appId];
    if (!browser || (browser.hiddenSince !== null) === hidden) return state;
    return { browsers: { ...state.browsers, [appId]: { ...browser, hiddenSince: hidden ? Date.now() : null } } };
  }),
  release: (appId) => set((state) => {
    if (!state.browsers[appId]) return state;
    const browsers = { ...state.browsers };
    delete browsers[appId];
    return { browsers };
  }),
  releaseAll: () => set({ browsers: {} }),
  setStatusBarHidden: (statusBarHidden) => set({ statusBarHidden }),
}));

/** Drop every kept WebView, e.g. before website data is cleared. */
export function releaseAllBrowsers() { useBrowserHostStore.getState().releaseAll(); }
