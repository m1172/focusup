import type { DeviceUsageProvider } from './types';

/** Expo does not expose iOS Screen Time or Android UsageStats data. */
export const expoFallbackDeviceUsageProvider: DeviceUsageProvider = {
  async isAvailable() { return false; },
  async getUsage() { return { available: false, source: 'none', platforms: [] }; },
};
