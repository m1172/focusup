import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The signed-in account's profile, saved so Settings shows the name at once without asking the server each time. */
export type CachedProfile = { userId: string; displayName: string; fetchedAt: number };

export const useProfileStore = create<{ profile: CachedProfile | null; setProfile: (profile: CachedProfile | null) => void }>()(persist((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}), {
  // Under "focusup-", so "Clear FocusUp data" and account deletion remove it.
  name: 'focusup-profile-v1',
  version: 1,
  storage: createJSONStorage(() => AsyncStorage),
  partialize: ({ profile }) => ({ profile }),
}));
