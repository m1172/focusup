import type { SocialPlatform } from '../analytics/types';

export type DeviceUsageResult = {
  available: boolean;
  source: 'native' | 'none';
  platforms: { platform: SocialPlatform; durationMs: number }[];
};

export interface DeviceUsageProvider {
  isAvailable(): Promise<boolean>;
  getUsage(startDate: Date, endDate: Date): Promise<DeviceUsageResult>;
}
