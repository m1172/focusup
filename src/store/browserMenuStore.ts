import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Where the user dragged the browser's menu button, as fractions (0–1) of the space it can move in,
 * so it lands in the same spot on any screen size or rotation. `null` = the default, bottom right.
 */
export type MenuButtonSpot = { x: number; y: number };

export const useBrowserMenuStore = create<{ spot: MenuButtonSpot | null; setSpot: (spot: MenuButtonSpot | null) => void }>()(persist((set) => ({
  spot: null,
  setSpot: (spot) => set({ spot }),
}), { name: 'focusup-browser-menu-v1', version: 1, storage: createJSONStorage(() => AsyncStorage), partialize: ({ spot }) => ({ spot }) }));
