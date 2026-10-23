import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useRemoteBlockerConfigStore } from '../../store/remoteBlockerConfigStore';

/** App version, OS and filter-rule versions, so a report can be matched to the rules that failed. */
export function useDiagnostics(): string {
  const rules = useRemoteBlockerConfigStore((state) => state.config);
  const version = Constants.expoConfig?.version ?? '1.0';
  const os = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Platform.Version}`;
  return `FocusUp ${version} · ${os} · Instagram rules: ${rules.platforms.instagram?.version ?? 'bundled'} · YouTube rules: ${rules.platforms.youtube?.version ?? 'bundled'}`;
}
