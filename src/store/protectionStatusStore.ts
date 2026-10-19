import { create } from 'zustand';
import type { NativeProtectionStatus } from '../services/protection/types';

export const useProtectionStatusStore = create<{ status: NativeProtectionStatus; setStatus: (status: NativeProtectionStatus) => void }>((set) => ({ status: { supported: false, authorized: false, selectedCount: 0, active: false }, setStatus: (status) => set({ status }) }));
