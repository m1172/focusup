import { FontAwesome6 } from '@expo/vector-icons';
import { View } from 'react-native';
import type { SocialAppId } from '../types/app';
import { useAppTheme } from '../theme';

const brandIcons: Record<SocialAppId, string> = {
  instagram: 'instagram',
  youtube: 'youtube',
  tiktok: 'tiktok',
  x: 'x-twitter',
  reddit: 'reddit-alien',
  snapchat: 'snapchat',
  facebook: 'facebook-f',
  linkedin: 'linkedin-in',
};

/** Brand logo tile. The logo uses the active theme's app ink color. */
export function AppIcon({ appId, size = 52, dimmed = false }: { appId: SocialAppId; size?: number; dimmed?: boolean }) {
  const c = useAppTheme();
  const tile = c.apps[appId];
  const radius = Math.round(size * 0.3);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: tile.bg, alignItems: 'center', justifyContent: 'center', opacity: dimmed ? (c.isDark ? 0.7 : 0.75) : 1 }}
    >
      <FontAwesome6 name={brandIcons[appId] as never} iconStyle="brand" size={Math.round(size * 0.5)} color={tile.ink} />
    </View>
  );
}
