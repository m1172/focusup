import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { ActionButton, Card, Screen } from '../../components/ui';
import { OnboardingHeader, StepTitle } from '../../features/onboarding/components';
import { HORIZON_YEARS, formatInteger, unitFor, weekGridRuns, weeksAhead, type GridRun, type HorizonYears } from '../../features/onboarding/dayBudget';
import { useAppStore } from '../../store/appStore';
import { totalMinutes, useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme';

/** Columns per horizon, so a short horizon gets big squares and ten years still fits on screen. */
const COLUMNS: Record<HorizonYears, number> = { 1: 13, 5: 26, 10: 52 };

/** "6.9" in English, "6,9" in Russian and Uzbek; whole numbers drop the decimal. */
function formatYears(value: number, locale: string) {
  const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return locale === 'en' ? text : text.replace('.', ',');
}

/** One rounded square per week, scrolling first. At most 520 squares. */
function WeeksGrid({ runs, columns, total, colors }: { runs: GridRun[]; columns: number; total: number; colors: Record<GridRun['kind'], string> }) {
  const [width, setWidth] = useState(0);
  const gap = columns > 30 ? 1.5 : columns > 15 ? 3 : 5;
  // The last column has no gap after it, so the squares fill the full width.
  const pitch = (width + gap) / columns;
  const cell = Math.max(1, pitch - gap);
  const rows = Math.ceil(total / columns);
  const height = rows * pitch - gap;
  const squares: { x: number; y: number; kind: GridRun['kind'] }[] = [];
  for (const run of runs) for (let i = 0; i < run.length; i += 1) squares.push({ x: (run.start + i) * pitch, y: run.row * pitch, kind: run.kind });
  return <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: Math.max(1, height) }}>
    {width > 0 ? <Svg width={width} height={height}>
      {squares.map((sq, i) => <Rect key={i} x={sq.x} y={sq.y} width={cell} height={cell} rx={Math.min(cell * 0.28, 6)} fill={colors[sq.kind]} />)}
    </Svg> : null}
  </View>;
}

/** Step 4: the coming years as weeks — scrolling, sleep and everything else — at today's habit. No lifespan is assumed. */
export default function LifeWeeksScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const age = useOnboardingStore((s) => s.age);
  const dailyMinutes = useOnboardingStore(totalMinutes);
  const [years, setYears] = useState<HorizonYears>(10);
  const weeks = useMemo(() => weeksAhead(years, dailyMinutes), [years, dailyMinutes]);
  const runs = useMemo(() => weekGridRuns(weeks, COLUMNS[years]), [weeks, years]);
  const colors: Record<GridRun['kind'], string> = { scrolling: c.red, sleep: c.blue, remaining: c.mint };
  const weekWords = t('onboarding.weekWords', { returnObjects: true }) as string[];
  const yearWords = t('onboarding.yearWords', { returnObjects: true }) as string[];
  const yearsLabel = (n: number | string) => `${n} ${unitFor(locale, String(n), yearWords)}`;
  const scrollText = weeks.scrollingYears >= 1
    ? yearsLabel(formatYears(weeks.scrollingYears, locale))
    : `${formatInteger(weeks.scrolling, locale)} ${unitFor(locale, formatInteger(weeks.scrolling, locale), weekWords)}`;
  const legend = [
    { kind: 'scrolling' as const, label: t('onboarding.lifeScrolling') },
    { kind: 'sleep' as const, label: t('onboarding.lifeSleep') },
    { kind: 'remaining' as const, label: t('onboarding.lifeRemaining') },
  ];
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(550).easing(Easing.out(Easing.cubic)));

  return <Screen glow={320} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('continue')} arrow onPress={() => router.push('/onboarding/reveal')} />}>
    <OnboardingHeader step={4} from={3} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.lifeTitle')} body={t('onboarding.lifeBody')} /></View>

    <Animated.View entering={enter(150)} accessibilityRole="radiogroup" style={{ marginTop: 18, flexDirection: 'row', gap: 6, padding: 4, borderRadius: 18, backgroundColor: c.card2 }}>
      {HORIZON_YEARS.map((option) => {
        const selected = option === years;
        return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { if (!selected) { void Haptics.selectionAsync(); setYears(option); } }}
          style={{ flex: 1, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.card : 'transparent', boxShadow: selected ? c.sh : undefined }}>
          <Text style={{ color: selected ? c.text : c.text2, fontSize: 15, fontWeight: selected ? '800' : '600' }}>{yearsLabel(option)}</Text>
        </Pressable>;
      })}
    </Animated.View>

    <Animated.View entering={enter(250)} style={{ marginTop: 12 }}>
      <Card style={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
          {legend.map((item) => <View key={item.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors[item.kind] }} />
            <Text style={{ color: item.kind === 'scrolling' ? c.red : c.text2, fontSize: 13, fontWeight: '700' }}>{item.label}</Text>
          </View>)}
        </View>
        <Animated.View key={years} entering={reducedMotion ? undefined : FadeIn.duration(450)}>
          <WeeksGrid runs={runs} columns={COLUMNS[years]} total={weeks.total} colors={colors} />
        </Animated.View>
      </Card>
    </Animated.View>

    <Animated.View entering={enter(600)} style={{ marginTop: 14, padding: 16, gap: 4, borderRadius: 20, backgroundColor: c.redSoft }}>
      <Text style={{ color: c.red, fontSize: 16, lineHeight: 23, fontWeight: '800' }}>{t('onboarding.lifeYears', { horizon: yearsLabel(years), years: scrollText })}</Text>
      {age ? <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{t('onboarding.lifeAge', { age: age + years })}</Text> : null}
    </Animated.View>
  </Screen>;
}
