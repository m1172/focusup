import { View } from 'react-native';
import { Text } from './Typography';
import { Icon } from './Icon';
import { HeroCard } from './ui';
import { useAppTheme } from '../theme';
import { useTranslation } from 'react-i18next';

export type HeroBar = { key: string | number; label: string; value: number; current?: boolean };

/** "2 soat 34 daqiqa" big metric used on Home (52px) and Statistics (48px). */
export function HeroDuration({ durationMs, size = 52 }: { durationMs: number; size?: 52 | 48 }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const minutes = Math.floor(durationMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const number = { color: '#FFFFFF', fontSize: size, lineHeight: size === 52 ? 56 : 52, fontWeight: '800' as const, letterSpacing: -0.04 * size };
  const unit = { color: c.onHero, fontSize: size === 52 ? 20 : 19, fontWeight: '700' as const };
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
    <Text style={number}>{hours}</Text><Text style={[unit, { marginRight: 8 }]}>{t('ui.hoursUnit')}</Text>
    <Text style={number}>{minutes % 60}</Text><Text style={unit}>{t('ui.minutesUnit')}</Text>
  </View>;
}

/** Rounded bar chart inside the hero card; the current slot is solid white with a glow. */
export function HeroBars({ bars, height, barWidth, radius, accessibilityLabel }: { bars: HeroBar[]; height: number; barWidth: number; radius: number; accessibilityLabel: string }) {
  const c = useAppTheme();
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height }}>
      {bars.map((bar) => <View key={bar.key} style={{ width: barWidth, height: bar.value > 0 ? Math.max(radius, Math.round(bar.value / max * height)) : Math.round(radius * 0.75), borderRadius: radius, backgroundColor: bar.current ? '#FFFFFF' : c.heroBar, boxShadow: bar.current ? c.heroBarGlow : undefined }} />)}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
      {bars.map((bar) => <View key={bar.key} style={{ width: barWidth, alignItems: 'center' }}><Text numberOfLines={1} style={{ minWidth: barWidth, width: 30, textAlign: 'center', color: bar.current ? '#FFFFFF' : c.onHero, fontSize: 12, lineHeight: 16, fontWeight: bar.current ? '800' : '600' }}>{bar.label}</Text></View>)}
    </View>
  </View>;
}

/** "↑ 45%  o‘tgan haftadan" */
export function HeroTrend({ percent, label }: { percent: number; label: string }) {
  const c = useAppTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingLeft: 8, paddingRight: 11, borderRadius: 14, backgroundColor: c.heroChip }}>
      <View style={{ transform: [{ rotate: percent >= 0 ? '0deg' : '180deg' }] }}><Icon name="arrowUp" size={14} color="#A8F7DC" strokeWidth={3} /></View>
      <Text style={{ color: '#A8F7DC', fontSize: 14, fontWeight: '800' }}>{Math.abs(percent)}%</Text>
    </View>
    <Text style={{ color: c.onHero, fontSize: 13, fontWeight: '600' }}>{label}</Text>
  </View>;
}

export { HeroCard };
