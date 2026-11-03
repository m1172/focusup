import { FontAwesome6 } from '@expo/vector-icons';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
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

// Instagram, YouTube and TikTok are drawn as vector shapes, not with the icon font: on Android the font's
// brand glyphs did not draw, which left blank tiles.
const TIKTOK = 'M448 209.9a210.1 210.1 0 0 1 -122.8-39.3V349.4A162.6 162.6 0 1 1 185 188.3V278.2a74.6 74.6 0 1 0 52.2 71.2V0l88 0a121.2 121.2 0 0 0 1.9 22.2h0A122.2 122.2 0 0 0 381 102.4a121.4 121.4 0 0 0 67 20.1z';

function Glyph({ appId, size }: { appId: 'instagram' | 'youtube' | 'tiktok'; size: number }) {
  if (appId === 'instagram') {
    const glyph = Math.round(size * 0.56);
    return <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
      <Rect x={2.1} y={2.1} width={19.8} height={19.8} rx={5.6} fill="none" stroke="#FFFFFF" strokeWidth={2.2} />
      <Circle cx={12} cy={12} r={4.6} fill="none" stroke="#FFFFFF" strokeWidth={2.2} />
      <Circle cx={17.4} cy={6.6} r={1.35} fill="#FFFFFF" />
    </Svg>;
  }
  if (appId === 'youtube') {
    const width = Math.round(size * 0.62);
    return <Svg width={width} height={Math.round(width * 0.7)} viewBox="0 0 28 19.6">
      <Rect x={0} y={0} width={28} height={19.6} rx={5.6} fill="#FF0033" />
      <Path d="M11.2 5.6 L19 9.8 L11.2 14 Z" fill="#FFFFFF" />
    </Svg>;
  }
  // TikTok's note has its cyan and pink edges: two offset copies under the white one.
  const height = Math.round(size * 0.56), width = Math.round(height * 448 / 512);
  const shift = Math.max(1, size * 0.035) * (512 / height);
  return <Svg width={width + 4} height={height + 4} viewBox={`${-2 * 512 / height} ${-2 * 512 / height} ${448 + 4 * 512 / height} ${512 + 4 * 512 / height}`}>
    <Path d={TIKTOK} fill="#25F4EE" transform={`translate(${-shift} ${-shift})`} />
    <Path d={TIKTOK} fill="#FE2C55" transform={`translate(${shift} ${shift})`} />
    <Path d={TIKTOK} fill="#FFFFFF" />
  </Svg>;
}

/** Brand logo tile: original colours for Instagram, YouTube and TikTok, the theme's tint for the rest. */
export function AppIcon({ appId, size = 52, dimmed = false }: { appId: SocialAppId; size?: number; dimmed?: boolean }) {
  const c = useAppTheme();
  const original = ORIGINAL[appId];
  const tile = c.apps[appId];
  const radius = Math.round(size * 0.3);
  const glyph = Math.round(size * 0.52);
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
      {appId === 'instagram' || appId === 'youtube' || appId === 'tiktok' ? <Glyph appId={appId} size={size} />
        : <FontAwesome6 name={brandIcons[appId] as never} iconStyle="brand" size={glyph} color={tile.ink} />}
    </View>
  );
}
