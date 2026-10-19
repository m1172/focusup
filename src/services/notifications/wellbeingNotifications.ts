import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { useAppStore } from '../../store/appStore';
import i18n from '../../i18n';
import { parseClock } from '../schedules/time';
import type { NativeProtectionPlan } from '../protection/types';

const PREFIX = 'focusup-wellbeing:';
export async function scheduleWellbeingNotifications(plan: NativeProtectionPlan): Promise<void> {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(pending.filter((item) => item.identifier.startsWith(PREFIX)).map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
    if (!useAppStore.getState().completionNotifications || !(await Notifications.getPermissionsAsync()).granted) return;
    const requests: { id: string; at: Date; title: string; body: string }[] = [];
    if (plan.temporary && plan.temporary.endsAt > Date.now()) requests.push({ id: 'access', at: new Date(plan.temporary.endsAt), title: i18n.t('wellbeing.accessEnded'), body: i18n.t('wellbeing.protectionRestored') });
    for (const routine of plan.routines.filter((item) => item.notify)) {
      for (let offset = 0; offset < 7; offset++) {
        const date = new Date(); date.setDate(date.getDate() + offset);
        const minute = parseClock(routine.start); date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
        if (date.getTime() <= Date.now() || !routine.weekdays.includes(date.getDay())) continue;
        requests.push({ id: `${routine.id}:${offset}`, at: date, title: i18n.t('wellbeing.routineStarted'), body: routine.id === 'focusup-sleep' ? i18n.t('wellbeing.sleepStarted') : i18n.t('wellbeing.routineProtection') });
      }
    }
    for (const item of requests.slice(0, 48)) await Notifications.scheduleNotificationAsync({ identifier: PREFIX + item.id, content: { title: item.title, body: item.body, data: { kind: 'wellbeing', route: '/(tabs)/focus' } }, trigger: { type: SchedulableTriggerInputTypes.DATE, date: item.at, channelId: 'default' } });
  } catch { /* Optional reminders never decide whether protections are active. */ }
}
