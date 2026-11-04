import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { formatSessionTime, useSessionSeconds } from './BrowserSessionBar';

/** True for page colors where light text reads better (Instagram's and YouTube's dark themes). */
export function isDarkColor(hex: string): boolean {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return false;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! < 0.5;
}

/** Under the status bar: time in this session and how many posts or videos it took, in the page's own colors. */
export function BrowserTopStrip({ active, background, count, unit }: { active: boolean; background: string; count: number; unit: 'posts' | 'videos' }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const time = formatSessionTime(useSessionSeconds(active));
  const dark = isDarkColor(background);
  const color = dark ? '#F5F5F5' : '#1C1C1E';
  const label = count > 0 ? t(unit === 'posts' ? 'browser.postsSeen' : 'browser.videosSeen', { count }) : null;
  return <View accessible accessibilityRole="timer" accessibilityLabel={[t('browser.sessionClock', { time }), label].filter(Boolean).join(', ')}
    style={[styles.strip, { paddingTop: insets.top, backgroundColor: background, borderBottomColor: dark ? '#FFFFFF1F' : '#0000000F' }]}>
    <View style={styles.row}>
      <Ionicons name="stopwatch-outline" size={18} color={dark ? '#A8A8A8' : '#737378'} />
      <Text style={[styles.text, { color }]}>{label ? `${time} · ${label}` : time}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  strip: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  text: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
