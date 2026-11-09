import { useCallback } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { Icon } from '../../components/Icon';
import { ActionButton, Heading, Note, Pill, Screen } from '../../components/ui';
import { useShowsChildrenTab } from '../../features/family/childrenTab';
import { timeAgo } from '../../features/family/format';
import { useFamilyParentStore } from '../../features/family/parentData';
import { childState, statusVariant } from '../../features/family/status';
import { summarizeUsage } from '../../features/family/usage';
import { ageBand, ageOn, BROWSER_APPS } from '../../services/family/policy';
import type { FamilyChild } from '../../services/family/types';
import { useAppTheme } from '../../theme';

const REFRESH_MS = 30_000;

/** One child at a glance: status, last contact, and today's time in each clean browser against its limit. */
function ChildCard({ child }: { child: FamilyChild }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const state = childState(child);
  const under13 = ageBand(child.birthDate) === 'child';
  const summary = summarizeUsage(child.usage ?? [], child.policy.policy, child.device?.report?.utcOffsetMinutes ?? null);
  const apps = BROWSER_APPS.filter((app) => child.policy.policy.browsers[app]?.enabled);
  const todayTotal = apps.reduce((sum, app) => sum + (summary.today[app].minutes ?? 0), 0);
  const weekTotal = summary.days.reduce((sum, day) => sum + BROWSER_APPS.reduce((inner, app) => inner + (day.minutes[app] ?? 0), 0), 0);
  const reported = summary.days[0]?.reported ?? false;
  const seen = child.device ? timeAgo(t, child.device.lastSeenAt) : null;
  const minutes = (value: number) => t('family.rules.minutes', { count: value });
  return <Pressable accessibilityRole="button" accessibilityLabel={`${child.nickname}, ${t(`family.status.${state}`)}`}
    onPress={() => router.push({ pathname: '/family/child/[childId]', params: { childId: child.id } })}
    style={({ pressed }) => ({ padding: 18, gap: 14, borderRadius: 26, backgroundColor: c.card, boxShadow: c.sh, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft }}>
        <Text style={{ color: c.primary, fontSize: 20, fontWeight: '800' }}>{child.nickname.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{child.nickname}</Text>
        <Text style={{ color: c.text2, fontSize: 13, fontWeight: '600' }}>{t('family.rules.age', { count: ageOn(child.birthDate) })}</Text>
        <Text numberOfLines={2} style={{ color: c.text3, fontSize: 12, fontWeight: '600' }}>{seen ? t('family.parent.lastContact', { time: seen }) : t('family.parent.neverContacted')}</Text>
      </View>
      <Pill label={t(`family.status.${state}`)} variant={statusVariant[state]} />
    </View>

    {under13 ? <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>{t('family.tab.blockingOnly')}</Text>
      : apps.length === 0 ? <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>{t('family.tab.noBrowsers')}</Text>
      : <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ color: c.text3, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{t('family.parent.usageToday')}</Text>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{reported ? minutes(todayTotal) : t('family.parent.usageNotReported')}</Text>
        </View>
        {apps.map((app) => {
          const today = summary.today[app];
          const share = today.minutes !== null && today.limit ? Math.min(1, today.minutes / today.limit) : 0;
          return <View key={app} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AppIcon appId={app} size={24} />
              <Text style={{ flex: 1, color: c.text, fontSize: 15, fontWeight: '700' }}>{app === 'instagram' ? 'Instagram' : app === 'youtube' ? 'YouTube' : 'TikTok'}</Text>
              <Text style={{ color: today.overLimit ? c.red : today.minutes === null ? c.text3 : c.text2, fontSize: 14, fontWeight: '700' }}>
                {today.minutes === null ? '–' : today.limit !== null ? t('family.parent.usageOfLimit', { used: minutes(today.minutes), limit: minutes(today.limit) }) : minutes(today.minutes)}
              </Text>
            </View>
            {today.limit !== null ? <View style={{ height: 6, borderRadius: 3, backgroundColor: c.card2, overflow: 'hidden' }}><View style={{ width: `${Math.round(share * 100)}%`, height: 6, borderRadius: 3, backgroundColor: today.overLimit ? c.red : c.accent }} /></View> : null}
          </View>;
        })}
        <Text style={{ color: c.text2, fontSize: 13, fontWeight: '600' }}>{t('family.tab.week', { time: minutes(weekTotal) })}</Text>
      </View>}

    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
      <Text style={{ color: c.primary, fontSize: 14, fontWeight: '800' }}>{t('family.tab.manage')}</Text>
      <Icon name="chevron" size={16} color={c.primary} strokeWidth={2.4} />
    </View>
  </Pressable>;
}

/** The parent's Children tab (Vaqtim Family): every child's time and protection at a glance. */
export default function ChildrenScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const allowed = useShowsChildrenTab();
  const overview = useFamilyParentStore((state) => state.overview);
  const failed = useFamilyParentStore((state) => state.failed);
  const load = useFamilyParentStore((state) => state.load);
  useFocusEffect(useCallback(() => {
    if (!allowed) return undefined;
    void load();
    const timer = setInterval(() => { void load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [allowed, load]));

  if (!allowed) return <Redirect href="/(tabs)" />;
  const children = overview?.children ?? [];
  return <Screen glow={260} glowDarkOnly contentStyle={{ gap: 16 }}>
    <Heading size="large" title={t('family.tab.title')} subtitle={t('family.tab.subtitle')} />
    {!overview ? (failed
      ? <Note tone="amber" icon="info">{t('family.parent.loadFailed')}</Note>
      : <ActivityIndicator accessibilityLabel={t('cloudAuth.loading')} />)
      : !overview.family || children.length === 0
        ? <View style={{ gap: 14, padding: 20, borderRadius: 26, backgroundColor: c.card, boxShadow: c.sh, alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft }}><Icon name="users" size={30} color={c.primary} /></View>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>{t('family.tab.emptyTitle')}</Text>
          <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{t('family.tab.emptyBody')}</Text>
          <ActionButton title={t(overview.family ? 'family.parent.addChild' : 'family.tab.setUp')} onPress={() => router.push(overview.family ? '/family/add-child' : '/family')} />
        </View>
        : <>
          {children.map((child) => <ChildCard key={child.id} child={child} />)}
          <ActionButton secondary title={`+ ${t('family.parent.addChild')}`} onPress={() => router.push('/family/add-child')} />
        </>}
    <Note icon="info">{t('family.tab.privacy')}</Note>
  </Screen>;
}
