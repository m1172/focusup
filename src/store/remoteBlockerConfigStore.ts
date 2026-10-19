import { create } from 'zustand';
import type { SocialAppId } from '../types/app';

export type RemotePlatformRule = { version: number; enabled: boolean; features: Record<string, boolean>; selectors?: Record<string, string[]>; routes?: string[] };
export type RemoteBlockerConfig = { schemaVersion: 1; platforms: Partial<Record<Extract<SocialAppId, 'instagram' | 'youtube'>, RemotePlatformRule>> };
type RemoteConfigState = { config: RemoteBlockerConfig; source: 'bundled' | 'cache' | 'remote'; revision: number; setConfig: (config: RemoteBlockerConfig, source: RemoteConfigState['source']) => void };

export const bundledRemoteBlockerConfig: RemoteBlockerConfig = { schemaVersion: 1, platforms: {} };
export const useRemoteBlockerConfigStore = create<RemoteConfigState>((set) => ({
  config: bundledRemoteBlockerConfig,
  source: 'bundled',
  revision: 0,
  setConfig: (config, source) => set((state) => ({ config, source, revision: state.revision + 1 })),
}));

export function isRemoteFeatureEnabled(platform: 'instagram' | 'youtube', feature: string): boolean {
  const rule = useRemoteBlockerConfigStore.getState().config.platforms[platform];
  return rule?.enabled !== false && rule?.features[feature] !== false;
}
