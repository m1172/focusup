import { create } from 'zustand';
import type { NativeProtectionStatus } from '../services/protection/types';

/** `checked`: the phone has answered at least once since launch, so `status` is real and not the default. */
export const useProtectionStatusStore = create<{ status: NativeProtectionStatus; checked: boolean; setStatus: (status: NativeProtectionStatus) => void }>((set) => ({
  status: { supported: false, authorized: false, selectedCount: 0, active: false },
  checked: false,
  setStatus: (status) => set({ status, checked: true }),
}));
