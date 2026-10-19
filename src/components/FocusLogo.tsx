import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useAppTheme } from '../theme';

/** FocusUp app mark, identical to the design's SVG logo. */
export function FocusLogo({ size = 112, glow = true }: { size?: number; glow?: boolean }) {
  const c = useAppTheme();
  const id = `fuLogo${size}`;
  return <View style={{ width: size, height: size, borderRadius: size * (19 / 64), boxShadow: glow ? c.glow : undefined }}>
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7A6DFF" /><Stop offset="1" stopColor="#4338CA" /></LinearGradient></Defs>
      <Rect width="64" height="64" rx="19" fill={`url(#${id})`} />
      <Path d="M41.6 21.5A15 15 0 1 1 22.4 21.5" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
      <Circle cx="32" cy="33" r="4.5" fill="#fff" />
      <Circle cx="32" cy="17.5" r="3.2" fill="#6EF0C8" />
    </Svg>
  </View>;
}
