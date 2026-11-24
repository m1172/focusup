import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Android only: whether battery saving may stop Vaqtim's blocking, and the Settings screens that fix it. */
export type BackgroundStatus = { batteryRestricted: boolean; hasAutoStart: boolean; maker: string };
type BackgroundModule = {
  getBackgroundStatus?: () => Promise<BackgroundStatus>;
  openBatterySettings?: () => Promise<boolean>;
  openAutoStartSettings?: () => Promise<boolean>;
};

const module = Platform.OS === 'android' ? requireOptionalNativeModule<BackgroundModule>('FocusUpProtection') : null;

export const androidBackground = {
  /** False on iOS and on builds made before these functions existed. */
  supported: Boolean(module?.getBackgroundStatus),
  async status(): Promise<BackgroundStatus | null> { try { return (await module?.getBackgroundStatus?.()) ?? null; } catch { return null; } },
  async openBattery(): Promise<boolean> { try { return (await module?.openBatterySettings?.()) ?? false; } catch { return false; } },
  async openAutoStart(): Promise<boolean> { try { return (await module?.openAutoStartSettings?.()) ?? false; } catch { return false; } },
};
