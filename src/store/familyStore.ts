import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isBirthDate, isFamilyPolicy, type FamilyPolicy, type SupervisionRules } from '../services/family/policy';

/**
 * This phone's place in Vaqtim Family. `pending`: the child entered a code and waits for the parent.
 * `child`: supervised. The device secret itself is in SecureStore (services/family/deviceSync.ts), never here.
 */
export type FamilyRole = 'none' | 'pending' | 'child';
export type PendingPairing = { childNickname: string; parentName: string; confirmationCode: string; expiresAt: number };
export type Supervision = { childNickname: string; parentName: string; birthDate: string; policy: FamilyPolicy; revision: number };
/** Shown once after the family rules were lifted from this phone. */
export type FamilyNotice = 'released' | 'revoked' | 'ended';

type FamilyState = {
  role: FamilyRole;
  pending: PendingPairing | null;
  supervision: Supervision | null;
  /** The newest rules revision this phone applied; reported to the parent as "Applied". */
  appliedRevision: number | null;
  lastSyncAt: number | null;
  notice: FamilyNotice | null;
  /** Someone chose the personal path (Start or Sign in) on this phone, so analytics may run. */
  personalChosen: boolean;
  setPending: (pending: PendingPairing) => void;
  setSupervision: (supervision: Supervision) => void;
  setApplied: (revision: number) => void;
  setSynced: (at: number) => void;
  release: (notice: FamilyNotice | null) => void;
  dismissNotice: () => void;
  choosePersonal: () => void;
  /** Someone opened "Connect to my parent": analytics stop until a role is settled. */
  chooseChildPath: () => void;
};

const empty = { role: 'none' as FamilyRole, pending: null, supervision: null, appliedRevision: null, lastSyncAt: null };

function validSupervision(value: unknown): value is Supervision {
  if (!value || typeof value !== 'object') return false;
  const item = value as Supervision;
  return typeof item.childNickname === 'string' && item.childNickname.length <= 40 && typeof item.parentName === 'string' && item.parentName.length <= 80
    && isBirthDate(item.birthDate) && isFamilyPolicy(item.policy) && Number.isSafeInteger(item.revision) && item.revision >= 1;
}
function validPending(value: unknown): value is PendingPairing {
  if (!value || typeof value !== 'object') return false;
  const item = value as PendingPairing;
  return typeof item.childNickname === 'string' && typeof item.parentName === 'string' && /^\d{6}$/.test(item.confirmationCode) && Number.isFinite(item.expiresAt);
}

export const useFamilyStore = create<FamilyState>()(persist((set) => ({
  ...empty,
  notice: null,
  personalChosen: false,
  setPending: (pending) => set({ role: 'pending', pending, supervision: null, appliedRevision: null }),
  setSupervision: (supervision) => set((state) => ({ role: 'child', pending: null, supervision, appliedRevision: state.role === 'child' ? state.appliedRevision : null })),
  setApplied: (appliedRevision) => set({ appliedRevision }),
  setSynced: (lastSyncAt) => set({ lastSyncAt }),
  release: (notice) => set({ ...empty, notice }),
  dismissNotice: () => set({ notice: null }),
  choosePersonal: () => set({ personalChosen: true }),
  chooseChildPath: () => set({ personalChosen: false }),
}), {
  name: 'focusup-family-v1',
  version: 1,
  storage: createJSONStorage(() => AsyncStorage),
  partialize: ({ role, pending, supervision, appliedRevision, lastSyncAt, notice, personalChosen }) => ({ role, pending, supervision, appliedRevision, lastSyncAt, notice, personalChosen }),
  // A damaged record never drops supervision silently: a supervised phone with unreadable rules stays supervised
  // with the strictest starter rules until the next sync replaces them.
  merge: (persisted, current) => {
    const raw = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<FamilyState>;
    const notice = raw.notice === 'released' || raw.notice === 'revoked' || raw.notice === 'ended' ? raw.notice : null;
    const personalChosen = raw.personalChosen === true;
    if (raw.role === 'child') {
      const supervision = validSupervision(raw.supervision) ? raw.supervision : { childNickname: '', parentName: '', birthDate: '2015-01-01', revision: 1, policy: { schemaVersion: 1 as const, protectedApps: ['instagram', 'youtube', 'tiktok'], browsers: {}, downtime: [] } } satisfies Supervision;
      const appliedRevision = Number.isSafeInteger(raw.appliedRevision) ? raw.appliedRevision as number : null;
      return { ...current, role: 'child', pending: null, supervision, appliedRevision, lastSyncAt: Number.isFinite(raw.lastSyncAt) ? raw.lastSyncAt as number : null, notice, personalChosen };
    }
    if (raw.role === 'pending' && validPending(raw.pending)) return { ...current, role: 'pending', pending: raw.pending, notice, personalChosen };
    return { ...current, ...empty, role: raw.role === 'pending' ? 'pending' : 'none', notice, personalChosen };
  },
}));

/** True on a phone that is (or is becoming) supervised. Analytics, account sign-in and data reset stay off. */
export function isFamilyDevice(state: Pick<FamilyState, 'role'> = useFamilyStore.getState()) { return state.role !== 'none'; }

/** The rules this phone enforces, or null on a personal phone. */
export function currentSupervisionRules(state: Pick<FamilyState, 'role' | 'supervision'> = useFamilyStore.getState()): SupervisionRules | null {
  return state.role === 'child' && state.supervision ? { policy: state.supervision.policy, birthDate: state.supervision.birthDate } : null;
}
