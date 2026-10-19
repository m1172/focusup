import { getDailyActivityTimeline } from '../../services/analytics/activityTimeline';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { AppIcon } from '../../components/AppIcon';
import { CircleButton, Screen, SectionTitle, StatusDot } from '../../components/ui';
import { HeroBars, HeroCard, HeroDuration, HeroTrend } from '../../components/HeroStat';
import { appCatalog } from '../../features/apps/catalog';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import { getLocalAnalytics } from '../../services/analytics/localAnalytics';
import { getDailyStatistics, getWeeklyStatistics, getPreviousPeriodStatistics, getSafeComparisonPercent, getActiveDayCount } from '../../services/analytics/statisticsCalculator';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { getEffectiveAppConfig } from '../../services/blockers/effective';

const apps = ['instagram', 'youtube', 'tiktok', 'x'] as const;
const slots = [6, 9, 12, 15, 18, 21];

export default function DashboardScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  useAppStore((s) => s.apps); useAppStore((s) => s.schedules); useAppStore((s) => s.strictSession);
  useSubscriptionStore((s) => s.isPro); useWellbeingStore((s) => s.sleep);
  const revision = useStatisticsStore((s) => s.revision);
  const [duration, setDuration] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(6).fill(0));
  const [comparison, setComparison] = useState<number | undefined>();
  useFocusEffect(useCallback(() => {
    if (revision < 0) return undefined;
    let active = true;
    void getLocalAnalytics().then((storage) => {
      if (!active) return;
      const now = new Date();
      setDuration(getDailyStatistics(storage.daily).cleanModeDurationMs);
      const week = getWeeklyStatistics(storage.daily);
      const previous = getPreviousPeriodStatistics(storage.daily, 'week', now);
      setComparison(getSafeComparisonPercent(week.cleanModeDurationMs, previous.cleanModeDurationMs, getActiveDayCount(storage.daily, previous.startDate, previous.endDate), 3));
      setBars(getDailyActivityTimeline(storage.events, now).slice(2).map((item) => item.durationMs));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [revision]));
  const hour = new Date().getHours();
  return <Screen glow={360} contentStyle={{ gap: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{t('hello')}</Text>
      <View>
        <CircleButton label={t('wellbeing.notifications')} icon="bell" strokeWidth={1.9} onPress={() => router.push('/permissions')} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, boxShadow: `0px 0px 0px 2px ${c.card}` }} />
      </View>
    </View>

    <HeroCard>
      <Text style={{ color: c.onHero, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{t('ui.savedPeriod.day')}</Text>
      <View style={{ marginTop: 6 }}><HeroDuration durationMs={duration} /></View>
      <View style={{ marginTop: 10, minHeight: 28, justifyContent: 'center' }}>
        {comparison !== undefined ? <HeroTrend percent={comparison} label={t('ui.vsLastWeek')} /> : <Text style={{ color: c.onHero, fontSize: 13, fontWeight: '600' }}>{t('cleanModeActivity')}</Text>}
      </View>
      <View style={{ marginTop: 18 }}>
        <HeroBars height={96} barWidth={38} radius={12} accessibilityLabel={t('cleanModeUsageChart')} bars={slots.map((slot, i) => ({ key: slot, label: String(slot), value: bars[i] ?? 0, current: hour >= slot && hour < slot + 3 }))} />
      </View>
    </HeroCard>

    <View style={{ gap: 12 }}>
      <SectionTitle title={t('apps')} right={<Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.navigate('/(tabs)/apps')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>{t('design.all')}</Text><Icon name="chevron" size={18} color={c.ink} strokeWidth={2.2} /></Pressable>} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{apps.map((appId) => {
        const active = appCatalog[appId].supported && getEffectiveAppConfig(appId).enabled;
        return <Pressable key={appId} accessibilityRole="button" accessibilityLabel={`${appCatalog[appId].name}, ${t(active ? 'cleaned' : 'off')}`} onPress={() => router.push({ pathname: appCatalog[appId].supported ? '/browser/[appId]' : '/app-settings/[appId]', params: { appId } })} style={({ pressed }) => ({ width: '47%', flexGrow: 1, height: 64, paddingHorizontal: 12, borderRadius: 20, backgroundColor: c.card, boxShadow: c.sh, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.8 : 1 })}>
          <AppIcon appId={appId} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, lineHeight: 20, fontWeight: '800' }}>{appCatalog[appId].name}</Text>
            <View style={{ marginTop: 1 }}><StatusDot on={active} label={t(active ? 'cleaned' : 'off')} /></View>
          </View>
        </Pressable>;
      })}</View>
    </View>

    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 64, paddingHorizontal: 18, borderRadius: 22, backgroundColor: c.soft, boxShadow: c.isDark ? '0px 0px 0px 1px rgba(130,119,255,0.18)' : undefined }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkles" size={20} color={c.ink} /></View>
      <Text style={{ flex: 1, color: c.ink, fontWeight: '800', fontSize: 17, letterSpacing: -0.17 }}>{t('cleanMore')}</Text>
    </View>
  </Screen>;
}
