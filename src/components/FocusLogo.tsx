import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useAppTheme } from '../theme';

/** Vaqtim app mark: a clock on the brand gradient. */
export function FocusLogo({ size = 112, glow = true }: { size?: number; glow?: boolean }) {
  const c = useAppTheme();
  const id = `fuLogo${size}`;
  return <View style={{ width: size, height: size, borderRadius: size * (19 / 64), boxShadow: glow ? c.glow : undefined }}>
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7A6DFF" /><Stop offset="1" stopColor="#4338CA" /></LinearGradient></Defs>
      <Rect width="64" height="64" rx="19" fill={`url(#${id})`} />
      {/* Clock ring left open at the top right, where the mint dot (the time you get back) sits. Same shape as assets/icon.png. */}
      <Path d="M45.59 25.66A15 15 0 1 1 32 17" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
      <Path d="M32 23.5V32l6 4" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="40.06" cy="19.35" r="3.4" fill="#6EF0C8" />
    </Svg>
  </View>;
}
