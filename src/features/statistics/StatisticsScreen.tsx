import { getDailyActivityTimeline } from '../../services/analytics/activityTimeline';
import { Text } from '../../components/Typography';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Heading, Screen, SectionTitle, Segmented, Sheet, SheetActions } from '../../components/ui';
import { HeroBars, HeroCard, HeroDuration, type HeroBar } from '../../components/HeroStat';
import { Icon, type IconName } from '../../components/Icon';
import { AppIcon } from '../../components/AppIcon';
import { appCatalog } from '../apps/catalog';
import { getLocalAnalytics } from '../../services/analytics/localAnalytics';
import { calculatePeriodStatistics } from '../../services/analytics/statisticsCalculator';
import type { AnalyticsStorage } from '../../services/analytics/types';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import { formatDurationMs } from '../../utils/duration';
import { useSubscription } from '../../hooks/useSubscription';
import { canUseFeature } from '../../services/subscription/subscriptionService';
import type { Period } from '../../types/app';
import { timeEquivalents } from './timeEquivalents';
import { withCount } from '../../utils/plural';

const HERO_INNER_WIDTH = 298;

export function StatisticsScreen() {
  const c = useAppTheme();
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.selectedLanguage);
  const selectedPeriod = useStatisticsStore((state) => state.selectedPeriod);
  const setPeriod = useStatisticsStore((state) => state.setPeriod);
  const revision = useStatisticsStore((state) => state.revision);
  const isPro = useSubscription().isPro;
  const [showProSheet, setShowProSheet] = useState(false);
  const [dayTimeline, setDayTimeline] = useState<ReturnType<typeof getDailyActivityTimeline>>([]);
  const [daily, setDaily] = useState<AnalyticsStorage['daily']>({});

  useFocusEffect(useCallback(() => {
    let focused = true;
    const requestedRevision = revision;
    void getLocalAnalytics().then((data) => {
      if (focused && requestedRevision === useStatisticsStore.getState().revision) {
        setDaily(data.daily);
        setDayTimeline(getDailyActivityTimeline(data.events));
      }
    }).catch(() => undefined);
    return () => { focused = false; };
  }, [revision]));

  const now = new Date();
  const visiblePeriod = canUseFeature(isPro, 'advancedStatistics') ? selectedPeriod : 'day';
  const statistics = calculatePeriodStatistics(daily, visiblePeriod, now);
  const weekdays = t('ui.weekdaysShort', { returnObjects: true }) as string[];
  const months = t('ui.monthLetters', { returnObjects: true }) as string[];

  const bars: HeroBar[] = visiblePeriod === 'day'
    ? dayTimeline.slice(2).map((item) => { const h = new Date(item.timestamp).getHours(); return { key: item.timestamp, label: String(h), value: item.durationMs, current: now.getHours() >= h && now.getHours() < h + 3 }; })
    : statistics.timeline.map((item, index) => {
      const date = new Date(item.timestamp);
      const label = visiblePeriod === 'week' ? weekdays[(date.getDay() + 6) % 7]
        : visiblePeriod === 'month' ? (index % 5 === 0 ? String(date.getDate()) : '')
          : months[date.getMonth()];
      const current = visiblePeriod === 'year' ? date.getMonth() === now.getMonth() : date.toDateString() === now.toDateString();
      return { key: item.timestamp, label, value: item.durationMs, current };
    });
  const count = Math.max(1, bars.length);
  const barWidth = count <= 7 ? 34 : Math.max(4, Math.floor((HERO_INNER_WIDTH - (count - 1) * 3) / count));

  const platforms = statistics.platforms.filter((entry) => entry.durationMs > 0).sort((a, b) => b.durationMs - a.durationMs);
  const platformRows = platforms.length > 0 ? platforms : (['instagram', 'youtube'] as const).map((platform) => ({ platform, durationMs: 0 }));
  const maxPlatform = Math.max(1, ...platformRows.map((row) => row.durationMs));

  const totalMinutes = Math.floor(statistics.cleanModeDurationMs / 60_000);
  const eq = timeEquivalents(totalMinutes);
  const equivalents: { icon: IconName; label: string; bg: string; fg: string; ring: string }[] = [
    { icon: 'book', label: eq.readingHours > 0 ? t('ui.readingHours', { count: eq.readingHours }) : t('ui.readingMinutes', { count: eq.readingMinutes }), bg: c.blueSoft, fg: c.blue, ring: c.ringBlue },
    { icon: 'run', label: withCount(locale, eq.workouts, t('ui.workoutWords', { returnObjects: true }) as string[]), bg: c.mintSoft, fg: c.mintInk, ring: c.isDark ? '0px 0px 0px 1px rgba(52,211,160,0.16)' : '' },
    { icon: 'moon', label: t('ui.moreSleep'), bg: c.soft, fg: c.ink, ring: c.ringSoft },
  ];

  return (
    <Screen glow={340} contentStyle={{ gap: 14 }}>
      <Heading size="large" title={t('stats')} />
      <Segmented<Period>
        value={visiblePeriod}
        options={(['day', 'week', 'month', 'year'] as const).map((period) => ({ value: period, label: t(period) }))}
        onChange={(period) => {
          if (period !== 'day' && !canUseFeature(isPro, 'advancedStatistics')) setShowProSheet(true);
          else setPeriod(period);
        }}
      />

      <HeroCard style={{ paddingVertical: 20 }}>
        <Text style={{ color: c.onHero, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{t(`ui.savedPeriod.${visiblePeriod}`)}</Text>
        <View style={{ marginTop: 4 }}><HeroDuration durationMs={statistics.cleanModeDurationMs} size={48} /></View>
        <View style={{ marginTop: 14 }}>
          <HeroBars height={84} barWidth={barWidth} radius={Math.min(11, Math.floor(barWidth / 2))} bars={bars} accessibilityLabel={`${t('cleanModeUsageChart')}: ${formatDurationMs(statistics.cleanModeDurationMs, locale)}`} />
        </View>
      </HeroCard>

      <View style={{ paddingVertical: 6, paddingHorizontal: 16, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
        {platformRows.map((row, index) => <View key={row.platform} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: index === 0 ? 52 : 53, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.line }}>
          <AppIcon appId={row.platform} size={36} />
          <Text numberOfLines={1} style={{ width: 78, color: c.text, fontSize: 15, fontWeight: '700' }}>{appCatalog[row.platform]?.name ?? row.platform}</Text>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.card2, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(row.durationMs / maxPlatform * 100)}%`, height: '100%', borderRadius: 4, backgroundImage: c.grad }} />
          </View>
          <Text style={{ width: 56, textAlign: 'right', color: c.text, fontSize: 14, fontWeight: '800' }}>{formatDurationMs(row.durationMs, locale)}</Text>
        </View>)}
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle size={18} title={t('ui.withThisTime')} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {equivalents.map((item) => <View key={item.icon} style={{ flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 22, backgroundColor: item.bg, boxShadow: item.ring || undefined, gap: 8 }}>
            <Icon name={item.icon} size={26} color={item.fg} />
            {/* Cards are ~83px wide: long single words (e.g. "тренировок") step down instead of breaking mid-word. */}
            <Text style={{ color: c.text, fontWeight: '800', ...(Math.max(...item.label.split(/\s+/).map((word) => word.length)) > 9 ? { fontSize: 12, lineHeight: 17 } : { fontSize: 14, lineHeight: 19 }) }}>{item.label}</Text>
          </View>)}
        </View>
      </View>

      <Sheet visible={showProSheet} onClose={() => setShowProSheet(false)} title={t('subscription.advancedStatsTitle')} message={t('subscription.advancedStatsMessage')}>
        <SheetActions cancel={t('subscription.notNow')} confirm={t('subscription.viewPro')} onCancel={() => setShowProSheet(false)} onConfirm={() => { setShowProSheet(false); router.push({ pathname: '/pro', params: { source: 'advanced_statistics' } }); }} />
      </Sheet>
    </Screen>
  );
}
