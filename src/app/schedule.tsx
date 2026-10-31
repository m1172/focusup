import { Text } from '../components/Typography';
import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Icon, type IconName } from '../components/Icon';
import { useTranslation } from 'react-i18next';
import { ActionButton, BackButton, Card, EmptyState, Heading, IconTile, Screen, Toggle, type TileTone } from '../components/ui';
import { useAppStore } from '../store/appStore';
import { useAppTheme } from '../theme';
import type { FocusSchedule, SocialAppId } from '../types/app';
import { useSubscription } from '../hooks/useSubscription';
import { canUseFeature } from '../services/subscription/subscriptionService';
import { AppIcon } from '../components/AppIcon';
import { PlatformPicker } from '../components/PlatformPicker';
import { appCatalog } from '../features/apps/catalog';
import { activeRoutines } from '../services/protection/engine';
import { parseClock } from '../services/schedules/time';
import { requestWellbeingReminders } from '../services/notifications/reminderPreference';

const days = ['sun','mon','tue','wed','thu','fri','sat'];
const presets = ['work','sleep','study'];
const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export default function ScheduleScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const isPro = useSubscription().isPro;
  const schedules = useAppStore((state) => state.schedules);
  const saveSchedule = useAppStore((state) => state.saveSchedule);
  const remove = useAppStore((state) => state.deleteSchedule);
  const toggleSchedule = useAppStore((state) => state.setScheduleEnabled);
  const [editing, setEditing] = useState<FocusSchedule | null>(null);
  const [name, setName] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [weekdays, setWeekdays] = useState<number[]>([1,2,3,4,5]);
  const [appIds, setAppIds] = useState<SocialAppId[]>(['instagram','youtube','tiktok']);
  const [allowedApps, setAllowedApps] = useState<SocialAppId[]>([]);
  const [routineStrict, setRoutineStrict] = useState(false);
  const [notify, setNotify] = useState(false);
  const [routineFilters, setRoutineFilters] = useState<FocusSchedule['filters']>({});
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const presetName = (value: string) => presets.includes(value) ? t(value) : value;
  const openEditor = (item?: FocusSchedule, confirmed = false) => {
    if (!confirmed && item?.strict && activeRoutines([item]).length) { Alert.alert(t('wellbeing.pauseRoutine'), t('wellbeing.pauseRoutineDetail'), [{ text: t('cancel'), style: 'cancel' }, { text: t('continue'), onPress: () => openEditor(item, true) }]); return; }
    setEditing(item ?? null); setName(item ? presetName(item.name) : ''); setStart(item?.start ?? '09:00'); setEnd(item?.end ?? '10:00');
    setWeekdays(item?.weekdays ?? [1,2,3,4,5]); setAppIds(item?.apps ?? ['instagram','youtube','tiktok']);
    setAllowedApps(item?.allowedApps ?? []); setRoutineStrict(item?.strict ?? false); setNotify(item?.notify ?? false); setRoutineFilters(item?.filters ?? {});
    setShowAppPicker(false); setAdvanced(false); setEditorOpen(true);
  };
  const toggleValue = <T,>(values: T[], value: T, set: (next: T[]) => void) => set(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const timeFields: { label: string; value: string; onChangeText: (value: string) => void }[] = [
    { label: t('startTime'), value: start, onChangeText: setStart },
    { label: t('endTime'), value: end, onChangeText: setEnd },
  ];
  const save = () => {
    if (!canUseFeature(isPro, 'schedules')) { setEditorOpen(false); router.push({ pathname: '/pro', params: { source: 'schedules' } }); return; }
    if (!name.trim() || !validTime(start) || !validTime(end) || start === end || weekdays.length === 0 || appIds.length === 0) { Alert.alert(t('schedules'), t('validationSchedule')); return; }
    if (!editing && schedules.length >= 15) { Alert.alert(t('schedules'), t('wellbeing.routineLimit')); return; }
    if ((parseClock(end) - parseClock(start) + 1440) % 1440 < 15) { Alert.alert(t('schedules'), t('wellbeing.nativeMinimum')); return; }
    saveSchedule({ allowedApps, strict: routineStrict, notify, filters: Object.fromEntries(appIds.map((id) => [id, routineFilters?.[id] ?? { ...useAppStore.getState().apps[id].filters }])), id: editing?.id ?? `schedule-${Date.now()}`, name: name.trim(), start, end, weekdays: [...weekdays].sort(), apps: appIds, enabled: editing?.enabled ?? true });
    setEditorOpen(false); setEditing(null);
  };
  const scheduleTile = (item: FocusSchedule): { icon: IconName; tone: TileTone } => {
    const value = item.name.toLowerCase();
    if (value.includes('ish') || value.includes('work')) return { icon: 'briefcase', tone: 'blue' };
    if (value.includes('uyqu') || value.includes('sleep')) return { icon: 'moon', tone: 'accent' };
    if (value.includes('o‘qish') || value.includes('study')) return { icon: 'book', tone: 'mint' };
    return { icon: 'clock', tone: 'accent' };
  };
  const letters = t('ui.weekdayLetters', { returnObjects: true }) as string[];
  const onToggle = (schedule: FocusSchedule, value: boolean) => {
    if (!canUseFeature(isPro, 'schedules')) { router.push({ pathname: '/pro', params: { source: 'schedules' } }); return; }
    if (!value && schedule.strict && activeRoutines([schedule]).length) {
      Alert.alert(t('wellbeing.pauseRoutine'), t('wellbeing.pauseRoutineDetail'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('continue'), onPress: () => toggleSchedule(schedule.id, value) },
      ]);
    } else {
      toggleSchedule(schedule.id, value);
    }
  };
  const confirmDelete = (schedule: FocusSchedule) => Alert.alert(t('delete'), presetName(schedule.name), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('delete'), style: 'destructive', onPress: () => { remove(schedule.id); setEditorOpen(false); setEditing(null); } },
  ]);

  return (
    <Screen navigation glow={300} contentStyle={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 }}>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -1.12 }}>{t('ui.scheduleTitle')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('ui.addSchedule')} onPress={() => openEditor()} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundImage: c.grad, boxShadow: c.glow, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}><Icon name="plus" size={22} color="#FFFFFF" strokeWidth={2.4} /></Pressable>
      </View>
      <Text style={{ color: c.text2, fontSize: 15, lineHeight: 22, fontWeight: '500' }}>{t('ui.scheduleBody')}</Text>

      {schedules.length === 0 ? <Card><EmptyState icon="clock" title={t('ui.noSchedules')} message={t('ui.noSchedulesBody')} /></Card> : null}
      <View style={{ gap: 12 }}>
        {schedules.map((schedule) => {
          const tile = scheduleTile(schedule);
          const label = presetName(schedule.name);
          return <Pressable key={schedule.id} accessibilityRole="button" accessibilityLabel={`${label}, ${schedule.start} – ${schedule.end}`} onPress={() => openEditor(schedule)} onLongPress={!schedule.id.startsWith('starter-') ? () => confirmDelete(schedule) : undefined} style={({ pressed }) => ({ padding: 16, gap: 14, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile name={tile.icon} tone={tile.tone} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.17 }}>{label}</Text>
                <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{schedule.start} – {schedule.end}</Text>
              </View>
              <Toggle label={`${label} ${t('schedules')}`} value={schedule.enabled} onChange={(value) => onToggle(schedule, value)} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6, flexShrink: 1 }}>{schedule.apps.map((appId) => <AppIcon key={appId} appId={appId} size={26} />)}</View>
              {schedule.weekdays.length === 7
                ? <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}>{t('ui.everyDay')}</Text>
                : <View style={{ flexDirection: 'row', gap: 4 }}>{[1, 2, 3, 4, 5, 6, 0].map((day, index) => {
                  const on = schedule.weekdays.includes(day);
                  return <View key={day} accessibilityLabel={t(days[day])} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: on ? c.soft : c.card2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: on ? c.ink : c.text3, fontSize: 11, fontWeight: '800' }}>{letters[index]}</Text></View>;
                })}</View>}
            </View>
          </Pressable>;
        })}
      </View>

      <Pressable accessibilityRole="button" onPress={() => openEditor()} style={({ pressed }) => ({ height: 52, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.off, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}>
        <Icon name="plus" size={18} color={c.ink} strokeWidth={2.4} />
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>{t('ui.newSchedule')}</Text>
      </Pressable>

    <Modal visible={editorOpen} animationType="slide" onRequestClose={() => { setEditorOpen(false); setEditing(null); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><Screen contentStyle={{ gap: 14 }} footer={<ActionButton title={t('saveSchedule')} onPress={save} />}>
        <BackButton label={t('back')} onPress={() => { setEditorOpen(false); setEditing(null); }} />
        <Heading title={editing ? t('editSchedule') : t('design.newRoutine')} />
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>{t('design.routineName')}</Text>
        <TextInput value={name} onChangeText={setName} placeholder={t('work')} placeholderTextColor={c.faint} style={{ color: c.text, fontFamily: 'Manrope-500', backgroundColor: c.surface, borderRadius: 18, paddingHorizontal: 16, height: 54, borderWidth: 1, borderColor: c.border }} />
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>{t('design.routineTime')}</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>{timeFields.map((field) => <View key={field.label} style={{ flex: 1, gap: 5 }}><Text style={{ color: c.muted, fontSize: 12 }}>{field.label}</Text><TextInput value={field.value} onChangeText={field.onChangeText} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} style={{ color: c.text, fontFamily: 'Manrope-600', backgroundColor: c.surface, borderRadius: 18, paddingHorizontal: 16, height: 54, borderWidth: 1, borderColor: c.border }} /></View>)}</View>
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>{t('design.routineDays')}</Text><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>{[1, 2, 3, 4, 5, 6, 0].map((index) => <Pressable key={index} accessibilityRole="checkbox" accessibilityState={{ checked: weekdays.includes(index) }} accessibilityLabel={t(days[index])} onPress={() => toggleValue(weekdays, index, setWeekdays)} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: weekdays.includes(index) ? c.primary : c.surface }}><Text style={{ color: weekdays.includes(index) ? '#fff' : c.muted, fontSize: 11, fontWeight: '700' }}>{t(days[index])}</Text></Pressable>)}</View>
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>{t('apps')}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAppPicker }} onPress={() => setShowAppPicker(!showAppPicker)}><Card style={{ flexDirection: 'row', alignItems: 'center', minHeight: 72, gap: 10 }}><View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>{appIds.map((id) => <AppIcon key={id} appId={id} size={32} />)}</View><Ionicons name={showAppPicker ? 'chevron-up' : 'chevron-forward'} size={20} color={c.faint} /></Card></Pressable>
        {showAppPicker ? <Card><PlatformPicker value={appIds} onChange={setAppIds} /></Card> : null}
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>{t('design.routineLevel')}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: advanced }} onPress={() => setAdvanced(!advanced)}><Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54 }}><Ionicons name="shield-checkmark-outline" size={22} color={c.primary} /><Text style={{ flex: 1, color: c.text, fontSize: 14 }}>{t(routineStrict ? 'strict' : 'design.standardProtection')}</Text><Ionicons name={advanced ? 'chevron-up' : 'chevron-forward'} size={20} color={c.faint} /></Card></Pressable>
        {advanced ? <View style={{ gap: 14 }}>
        <Heading title={t('wellbeing.allowedApps')} subtitle={t('wellbeing.allowedHint')} /><PlatformPicker value={allowedApps} onChange={setAllowedApps} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={{ flex: 1, color: c.text }}>{t('wellbeing.routineStrict')}</Text><Toggle label={t('wellbeing.routineStrict')} value={routineStrict} onChange={setRoutineStrict} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={{ flex: 1, color: c.text }}>{t('wellbeing.routineNotify')}</Text><Toggle label={t('wellbeing.routineNotify')} value={notify} onChange={(enabled) => { if (!enabled) setNotify(false); else void requestWellbeingReminders().then(setNotify); }} /></View>
        {appIds.filter((id) => appCatalog[id].supported).map((id) => <Card key={id}><Text style={{ color: c.text, fontWeight: '700' }}>{appCatalog[id].name}</Text>{appCatalog[id].filters.filter((key) => !['sponsoredPosts', 'sponsoredContent'].includes(key)).map((key) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text style={{ flex: 1, color: c.text }}>{t(key === 'homeFeed' ? 'wellbeing.feed' : key)}</Text><Toggle label={key} value={routineFilters?.[id]?.[key] ?? useAppStore.getState().apps[id].filters[key] ?? false} onChange={(value) => setRoutineFilters((current) => ({ ...current, [id]: { ...(current?.[id] ?? useAppStore.getState().apps[id].filters), [key]: value } }))} /></View>)}</Card>)}
        </View> : null}
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('wellbeing.nativeHint')}</Text>
        {editing && !editing.id.startsWith('starter-') ? <ActionButton variant="destructive" title={t('delete')} onPress={() => confirmDelete(editing)} /> : null}
      </Screen></KeyboardAvoidingView>
    </Modal>
  </Screen>
  );
}
