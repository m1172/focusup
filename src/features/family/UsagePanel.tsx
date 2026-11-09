import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { Panel } from '../settings/components';
import { BROWSER_APPS } from '../../services/family/policy';
import type { FamilyChild } from '../../services/family/types';
import { useAppTheme } from '../../theme';
import { timeAgo } from './format';
import { summarizeUsage } from './usage';

const NAMES = { instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok' } as const;

/** Today and the last 7 days of time in the clean browsers, against the parent's limits. Vaqtim time only. */
export function FamilyUsagePanel({ child }: { child: FamilyChild }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const summary = summarizeUsage(child.usage ?? [], child.policy.policy, child.device?.report?.utcOffsetMinutes ?? null);
  const minutes = (value: number) => t('family.rules.minutes', { count: value });
  const reported = summary.lastReportAt ? timeAgo(t, summary.lastReportAt) : null;
  const weekMax = Math.max(1, ...summary.days.map((day) => BROWSER_APPS.reduce((sum, app) => sum + (day.minutes[app] ?? 0), 0)));
  const weekdays = t('family.weekdays', { returnObjects: true }) as string[];
  return <Panel label={t('family.parent.usageTitle')}>
    <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18 }}>{t('family.parent.usageHint')}</Text>
    <Text style={{ color: c.text3, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{t('family.parent.usageToday')}</Text>
    {/* Only the browsers this child may open; the others can't have any time. */}
    {BROWSER_APPS.filter((app) => child.policy.policy.browsers[app]?.enabled || (summary.today[app].minutes ?? 0) > 0).map((app) => {
      const today = summary.today[app];
      const value = today.minutes === null ? t('family.parent.usageNotReported')
        : today.limit !== null ? t('family.parent.usageOfLimit', { used: minutes(today.minutes), limit: minutes(today.limit) }) : minutes(today.minutes);
      return <View key={app} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityLabel={`${NAMES[app]}: ${value}${today.overLimit ? `, ${t('family.parent.usageOverLimit')}` : ''}`}>
        <AppIcon appId={app} size={26} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>{NAMES[app]}</Text>
          {today.overLimit ? <Text style={{ color: c.red, fontSize: 12, fontWeight: '700' }}>{t('family.parent.usageOverLimit')}</Text> : null}
        </View>
        <Text style={{ color: today.overLimit ? c.red : today.minutes === null ? c.text3 : c.text2, fontSize: 14, fontWeight: '700' }}>{value}</Text>
      </View>;
    })}
    <Text style={{ color: c.text3, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{t('family.parent.usageWeek')}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 92 }}>
      {[...summary.days].reverse().map((day) => {
        const total = BROWSER_APPS.reduce((sum, app) => sum + (day.minutes[app] ?? 0), 0);
        const label = weekdays[new Date(`${day.day}T12:00:00Z`).getUTCDay()] ?? '';
        return <View key={day.day} style={{ flex: 1, alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`${label}: ${day.reported ? minutes(total) : t('family.parent.usageNotReported')}`}>
          <Text style={{ color: c.text3, fontSize: 10, fontWeight: '700' }}>{day.reported ? total : '–'}</Text>
          <View style={{ width: '70%', height: day.reported ? Math.max(3, Math.round((total / weekMax) * 56)) : 3, borderRadius: 4, backgroundColor: day.reported ? c.accent : c.line }} />
          <Text style={{ color: c.text2, fontSize: 11, fontWeight: '700' }}>{label}</Text>
        </View>;
      })}
    </View>
    {summary.lastReportAt === null ? <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18 }}>{t('family.parent.usageNever')}</Text>
      : summary.stale && reported ? <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18 }}>{t('family.parent.usageStale', { time: reported })}</Text> : null}
  </Panel>;
}
