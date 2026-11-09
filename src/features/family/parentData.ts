import { Alert } from 'react-native';
import { router } from 'expo-router';
import { create } from 'zustand';
import i18n from '../../i18n';
import { BackendError } from '../../services/backend/client';
import { accountApi, signOutAccount } from '../../services/backend/accountSession';
import type { FamilyChild, FamilyOverview } from '../../services/family/types';

/** The parent's family as last loaded from the server. Kept in memory only. */
type ParentState = {
  overview: FamilyOverview | null;
  loading: boolean;
  failed: boolean;
  load: () => Promise<FamilyOverview | null>;
  replaceChild: (child: Partial<FamilyChild> & { id: string }) => void;
};

export const useFamilyParentStore = create<ParentState>((set, get) => ({
  overview: null,
  loading: false,
  failed: false,
  load: async () => {
    set({ loading: true, failed: false });
    try {
      const overview = await accountApi().getFamily();
      set({ overview, loading: false });
      return overview;
    } catch {
      set({ loading: false, failed: true });
      return null;
    }
  },
  replaceChild: (child) => {
    const overview = get().overview;
    if (!overview) return;
    set({ overview: { ...overview, children: overview.children.map((item) => item.id === child.id ? { ...item, ...child } : item) } });
  },
}));

export function useFamilyChild(childId: string | undefined) {
  return useFamilyParentStore((state) => state.overview?.children.find((child) => child.id === childId) ?? null);
}

/** Short, translated message for a failed family request. */
export function familyErrorMessage(error: unknown): string {
  const code = error instanceof BackendError ? error.code : '';
  const known: Record<string, string> = {
    FAMILY_ENROLLMENT_CLOSED: 'family.parent.closed',
    FAMILY_COUNTRY_UNAVAILABLE: 'family.parent.countryUnavailable',
    FAMILY_AGE_INVALID: 'family.addChild.tooOld',
    FAMILY_REVISION_CONFLICT: 'family.parent.conflict',
    FAMILY_REMOVAL_PENDING: 'family.rules.removePending',
    FAMILY_PAIRING_ENDED: 'family.pair.ended',
    FAMILY_PAIRING_NOT_READY: 'family.pair.expired',
    NETWORK_ERROR: 'family.parent.loadFailed',
  };
  return i18n.t(known[code] ?? 'family.parent.failed');
}

/**
 * Pairing approval, phone replacement, removal and deletion need a sign-in from the last few minutes. When the
 * server asks for one, the parent signs out and in again, then repeats the step. Resolves to the action's result,
 * or undefined when it needed a new sign-in (the prompt is already shown).
 */
export async function runSensitive<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    if (!(error instanceof BackendError) || error.code !== 'REAUTH_REQUIRED') throw error;
    Alert.alert(i18n.t('family.parent.reauthTitle'), i18n.t('family.parent.reauthBody'), [
      { text: i18n.t('cancel'), style: 'cancel' },
      { text: i18n.t('family.parent.reauthAction'), onPress: () => { void signOutAccount().finally(() => { if (router.canDismiss()) router.dismissAll(); router.replace('/auth/sign-in'); }); } },
    ]);
    return undefined;
  }
}
