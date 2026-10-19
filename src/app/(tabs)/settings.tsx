import { useAccountStore } from '../../store/accountStore';
import { useStrictMode } from '../../hooks/useStrictMode';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import { formatDurationMs } from '../../utils/duration';
import { Text } from '../../components/Typography';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { Icon } from '../../components/Icon';
import type { ThemeMode } from '../../types/app';
import { useTranslation } from 'react-i18next';
import { GroupLabel, Heading, IconTile, Pill, Screen, Segmented, SettingRow, Toggle } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import { useSubscription } from '../../hooks/useSubscription';
import { cancelStrictModeCompletion, requestNotificationPermission, scheduleStrictModeCompletion } from '../../services/notifications/notificationService';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const subscription = useSubscription();
  const accountUser = useAccountStore((state) => state.user);
  const language = useAppStore((state) => state.selectedLanguage);
  const theme = useAppStore((state) => state.themeMode);
  const setTheme = useAppStore((state) => state.setTheme);
  const goal = useAppStore((state) => state.dailyGoalMinutes);
  const completionNotices = useAppStore((state) => state.completionNotifications);
  const setCompletionNotices = useAppStore((state) => state.setCompletionNotifications);
  const strictSession = useAppStore((state) => state.strictSession);
  const toggleCompletionNotices = (enabled: boolean) => {
    if (!enabled) { setCompletionNotices(false); void cancelStrictModeCompletion(); return; }
    Alert.alert(t('wellbeing.notificationPermissionTitle'), t('wellbeing.notificationPermissionBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('continue'), onPress: () => { void requestNotificationPermission().then((granted) => {
        if (granted) {
          setCompletionNotices(true);
          if (strictSession && strictSession.endsAt > Date.now()) void scheduleStrictModeCompletion(strictSession.endsAt);
        } else Alert.alert(t('strictNotificationUnavailable'), t('strictNotificationUnavailableDescription'), [{ text: t('cancel'), style: 'cancel' }, { text: t('openSettings'), onPress: () => { void Linking.openSettings(); } }]);
      }); } },
    ]);
  };
  const languageNames: Record<string, string> = {
    uz: 'O‘zbekcha',
    ru: 'Русский',
    en: 'English',
  };
  const currentLanguageName = languageNames[language] ?? language.toUpperCase();

  const nativeStatus = useProtectionStatusStore((state) => state.status);
  const strictActive = useStrictMode().active;
  const goalPicker = () => Alert.alert(t('ui.timeGoal'), '', [60, 120, 180].map((minutes) => ({ text: formatDurationMs(minutes * 60_000, language), onPress: () => useAppStore.getState().setDailyGoal(minutes) })).concat([{ text: t('cancel'), onPress: () => undefined }]));
  const group = (children: ReactNode) => <View style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>{children}</View>;
  return <Screen glow={260} glowDarkOnly contentStyle={{ gap: 12 }}>
    <Heading size="large" title={t('settings')} />

    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/pro', params: { source: 'settings' } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, height: 76, paddingHorizontal: 16, borderRadius: 24, backgroundImage: c.hero, boxShadow: c.heroSh, opacity: pressed ? 0.9 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.heroIconBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkle" size={24} color="#FFFFFF" /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.17 }}>FocusUp Pro</Text>
        <Text style={{ color: c.onHero, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{subscription.isPro ? t('ui.proActive') : t('ui.proBanner')}</Text>
      </View>
      <Icon name="chevron" size={20} color="#FFFFFF" strokeWidth={2.2} />
    </Pressable>

    <View style={{ gap: 6 }}>
      <GroupLabel title={t('ui.groupGeneral')} />
      {group(<>
        <SettingRow icon={<IconTile name="globe" tone="blue" />} title={t('language')} value={currentLanguageName} onPress={() => router.push('/language')} />
        <SettingRow icon={<IconTile name="contrast" tone="accent" />} title={t('theme')} value={t(`ui.themeValue.${theme}`)} onPress={() => router.push('/theme')} />
        <SettingRow icon={<IconTile name="bell" tone="red" />} title={t('ui.notifications')} right={<Toggle label={t('ui.notifications')} value={completionNotices} onChange={toggleCompletionNotices} />} />
        <SettingRow icon={<IconTile name="target" tone="mint" />} title={t('ui.timeGoal')} value={goal % 60 === 0 ? t('ui.goalValue', { hours: goal / 60 }) : formatDurationMs(goal * 60_000, language)} onPress={goalPicker} last />
      </>)}
    </View>

    <View style={{ gap: 6 }}>
      <GroupLabel title={t('ui.groupAccount')} />
      {group(<>
        <SettingRow icon={<IconTile name="key" tone="blue" />} title={t('cloudAuth.title')} value={accountUser ? t('cloudAuth.profile') : t('cloudAuth.signIn')} onPress={() => router.push('/account')} />
        <SettingRow icon={<IconTile name="shield" tone="accent" />} title={t('ui.privacy')} onPress={() => router.push('/privacy')} />
        <SettingRow icon={<IconTile name="help" tone="blue" />} title={t('support')} onPress={() => router.push('/help')} />
        <SettingRow icon={<IconTile name="info" tone="neutral" />} title={t('about')} right={<Text style={{ color: c.text2, fontSize: 14, fontWeight: '600' }}>v1.0</Text>} chevron onPress={() => router.push('/capabilities')} last />
      </>)}
    </View>

    <View style={{ gap: 6 }}>
      <GroupLabel title={t('ui.groupTheme')} />
      <Segmented<ThemeMode> height={40} value={theme} onChange={setTheme} options={[{ value: 'system', label: t('ui.themeSystem') }, { value: 'light', label: t('ui.themeLight') }, { value: 'dark', label: t('ui.themeDark') }]} />
    </View>

    <View style={{ gap: 6 }}>
      <GroupLabel title={t('ui.groupFocus')} />
      {group(<>
        <SettingRow icon={<IconTile name="lock" tone="accent" />} title={t('strict')} right={strictActive ? <Pill label={t('active')} variant="success" /> : undefined} chevron onPress={() => router.push('/strict-mode')} />
        <SettingRow icon={<IconTile name="calendar" tone="blue" />} title={t('schedules')} onPress={() => router.push('/schedule')} />
        <SettingRow icon={<IconTile name="key" tone="mint" />} title={t('design.permissions')} onPress={() => router.push('/permissions')} />
        <SettingRow icon={<IconTile name="shieldCheck" tone="mint" />} title={t('design.protectionStatus')} right={<Pill label={t(nativeStatus.active ? 'active' : 'off')} variant={nativeStatus.active ? 'success' : 'muted'} />} chevron onPress={() => router.push('/protection')} last />
      </>)}
    </View>
  </Screen>;
}
