export const MAX_PRO_ACCOUNT_SLOTS = 10;
export type SocialAccountSlot = { id: string; label: string; platform: 'instagram' | 'youtube'; nativeStoreId: string };
export interface IsolatedAccountSessionProvider {
  /** Must isolate cookies, Web Storage, HTTP cache and service workers together.
   * Never implement switching by copying authentication cookies through JS. */
  supportsPersistentIsolation(): Promise<boolean>;
  createStore(slotId: string): Promise<string>;
  deleteStore(nativeStoreId: string): Promise<void>;
}
export const accountSessionCapabilities = { websiteAccountSwitching: 'limited', isolatedFocusUpSlots: false, maximumFutureProSlots: MAX_PRO_ACCOUNT_SLOTS } as const;
