import type { SocialAppId } from '../../types/app';
import { ALL_PLATFORMS } from '../protection/engine';

export type CapabilityState = 'beta' | 'limited' | 'comingSoon' | 'unsupported';
export type PlatformCapabilities = { platform: SocialAppId; optimized: CapabilityState; nativeIOS: CapabilityState; nativeAndroid: CapabilityState; nativeSections: CapabilityState; accounts: CapabilityState; media: CapabilityState; notifications: CapabilityState; deviceTested: boolean };
export const capabilityRegistry: PlatformCapabilities[] = ALL_PLATFORMS.map((platform) => ({ platform, optimized: platform === 'instagram' || platform === 'youtube' || platform === 'tiktok' ? 'beta' : 'comingSoon', nativeIOS: 'beta', nativeAndroid: 'beta', nativeSections: 'unsupported', accounts: platform === 'instagram' || platform === 'youtube' ? 'limited' : 'unsupported', media: platform === 'instagram' || platform === 'youtube' ? 'limited' : 'unsupported', notifications: 'unsupported', deviceTested: false }));
