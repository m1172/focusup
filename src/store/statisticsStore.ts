import { create } from 'zustand';
import type { Period } from '../types/app';

type StatisticsState = {
  selectedPeriod: Period;
  revision: number;
  setPeriod: (period: Period) => void;
  notifyChanged: () => void;
};

export const useStatisticsStore = create<StatisticsState>((set) => ({
  selectedPeriod: 'week',
  revision: 0,
  setPeriod: (selectedPeriod) => set({ selectedPeriod }),
  notifyChanged: () => set((state) => ({ revision: state.revision + 1 })),
}));
