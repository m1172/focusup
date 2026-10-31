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

/** The apps Vaqtim offers wear their real app-icon colours, so people recognise them at a glance. */
const ORIGINAL: Partial<Record<SocialAppId, { bg?: string; image?: string; ink: string }>> = {
  instagram: { image: 'radial-gradient(circle at 30% 107%, #FDF497 0%, #FDF497 5%, #FD5949 45%, #D6249F 60%, #285AEB 90%)', ink: '#FFFFFF' },
  youtube: { bg: '#FFFFFF', ink: '#FF0033' },
  tiktok: { bg: '#000000', ink: '#FFFFFF' },
};

/** Brand logo tile: original colours for Instagram, YouTube and TikTok, the theme's tint for the rest. */
export function AppIcon({ appId, size = 52, dimmed = false }: { appId: SocialAppId; size?: number; dimmed?: boolean }) {
  const c = useAppTheme();
  const original = ORIGINAL[appId];
  const tile = c.apps[appId];
  const radius = Math.round(size * 0.3);
  const glyph = Math.round(size * (appId === 'youtube' ? 0.6 : 0.52));
  // TikTok's note has its cyan and pink edges: two offset copies under the white one.
  const shift = Math.max(1, Math.round(size * 0.035));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size, height: size, borderRadius: radius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
        backgroundColor: original ? original.bg : tile.bg, backgroundImage: original?.image,
        borderWidth: appId === 'youtube' ? 1 : 0, borderColor: c.line,
        opacity: dimmed ? (c.isDark ? 0.7 : 0.75) : 1,
      }}
    >
      {appId === 'tiktok' ? <>
        <FontAwesome6 name="tiktok" iconStyle="brand" size={glyph} color="#25F4EE" style={{ position: 'absolute', transform: [{ translateX: -shift }, { translateY: -shift }] }} />
        <FontAwesome6 name="tiktok" iconStyle="brand" size={glyph} color="#FE2C55" style={{ position: 'absolute', transform: [{ translateX: shift }, { translateY: shift }] }} />
      </> : null}
      <FontAwesome6 name={brandIcons[appId] as never} iconStyle="brand" size={glyph} color={original ? original.ink : tile.ink} />
    </View>
  );
}
