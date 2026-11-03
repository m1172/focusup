import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** One Instagram account in the in-app browser. Its sign-in cookies live in the secure store, never here. */
export type InstagramAccountSlot = { id: string; username: string; avatar: string; savedAt: number };

type InstagramAccountsState = {
  slots: InstagramAccountSlot[];
  activeId: string | null;
  setSlots: (slots: InstagramAccountSlot[], activeId: string | null) => void;
};

export const useInstagramAccountsStore = create<InstagramAccountsState>()(persist((set) => ({
  slots: [],
  activeId: null,
  setSlots: (slots, activeId) => set({ slots, activeId }),
}), { name: 'focusup-instagram-accounts-v1', version: 1, storage: createJSONStorage(() => AsyncStorage), partialize: ({ slots, activeId }) => ({ slots, activeId }) }));
