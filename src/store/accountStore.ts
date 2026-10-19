import { create } from 'zustand';
import type { SessionState } from '../services/backend/sessionManager';

// Access tokens and refresh tokens never enter the persisted app stores.
export const useAccountStore = create<SessionState>(() => ({ ready: false, user: null, recoveryRequired: false }));
