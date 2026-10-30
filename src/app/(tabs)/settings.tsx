import { PRO_ENABLED } from '../../config/release';
import { useAccountStore } from '../../store/accountStore';
import { useStrictMode } from '../../hooks/useStrictMode';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import { Text } from '../../components/Typography';
import { router, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { useCallback, type ReactNode } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useTranslation } from 'react-i18next';
import { GroupLabel, Heading, IconTile, Pill, Screen, SettingRow, Toggle } from '../../components/ui';
import { FocusLogo } from '../../components/FocusLogo';
import { Avatar } from '../../features/account/AccountScreen';
import { isBackendConfigured } from '../../services/backend/accountSession';
import { loadProfile } from '../../services/backend/profileCache';
import { useProfileStore } from '../../store/profileStore';
import { useSupportUnread } from '../../features/support/unread';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import { useSubscription } from '../../hooks/useSubscription';
import { cancelStrictModeCompletion, requestNotificationPermission, scheduleStrictModeCompletion } from '../../services/notifications/notificationService';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const subscription = useSubscription();
  const accountUser = useAccountStore((state) => state.user);
  const supportUnread = useSupportUnread(Boolean(accountUser) && isBackendConfigured());
  const language = useAppStore((state) => state.selectedLanguage);
  const theme = useAppStore((state) => state.themeMode);
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
  // The profile name is saved on the device; the server is asked only when no fresh copy exists.
  const profileName = useProfileStore((state) => accountUser && state.profile?.userId === accountUser.id ? state.profile.displayName.trim() : '');
  useFocusEffect(useCallback(() => {
    if (accountUser) void loadProfile(accountUser.id).catch(() => undefined);
  }, [accountUser]));
  const group = (children: ReactNode) => <View style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>{children}</View>;
  const version = Constants.expoConfig?.version ?? '1.0';
  return <Screen glow={260} glowDarkOnly contentStyle={{ gap: 18 }}>
    <Heading size="large" title={t('settings')} />

    <Pressable accessibilityRole="button" accessibilityLabel={accountUser ? t('cloudAuth.title') : t('settingsPages.signInTitle')} onPress={() => router.push(accountUser ? '/account' : '/auth/sign-in')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 26, backgroundColor: c.card, boxShadow: c.sh, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      {accountUser ? <Avatar label={profileName || accountUser.email || ''} /> : <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundImage: c.grad, boxShadow: c.glow }}><Icon name="key" size={24} color="#FFFFFF" strokeWidth={2} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.36 }}>{accountUser ? profileName || accountUser.email || t('cloudAuth.profile') : t('settingsPages.signInTitle')}</Text>
        <Text numberOfLines={1} style={{ color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{accountUser ? (profileName && accountUser.email ? accountUser.email : t('settingsPages.profileBody')) : t('settingsPages.signInBody')}</Text>
      </View>
      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft }}><Icon name="chevron" size={18} color={c.ink} strokeWidth={2.4} /></View>
    </Pressable>

    {PRO_ENABLED ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/pro', params: { source: 'settings' } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, height: 76, paddingHorizontal: 16, borderRadius: 24, backgroundImage: c.hero, boxShadow: c.heroSh, opacity: pressed ? 0.9 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.heroIconBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkle" size={24} color="#FFFFFF" /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.17 }}>Vaqtim Pro</Text>
        <Text style={{ color: c.onHero, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{subscription.isPro ? t('ui.proActive') : t('ui.proBanner')}</Text>
      </View>
      <Icon name="chevron" size={20} color="#FFFFFF" strokeWidth={2.2} />
    </Pressable> : null}

    <View style={{ gap: 6 }}>
      <GroupLabel title={t('settingsPages.groupApp')} />
      {group(<>
        <SettingRow icon={<IconTile name="globe" tone="blue" />} title={t('language')} value={currentLanguageName} onPress={() => router.push('/language')} />
        <SettingRow icon={<IconTile name="contrast" tone="accent" />} title={t('theme')} value={t(`ui.themeValue.${theme}`)} onPress={() => router.push('/theme')} last={!PRO_ENABLED} />
        {PRO_ENABLED ? <SettingRow icon={<IconTile name="bell" tone="red" />} title={t('ui.notifications')} right={<Toggle label={t('ui.notifications')} value={completionNotices} onChange={toggleCompletionNotices} />} last /> : null}
      </>)}
    </View>

    <View style={{ gap: 6 }}>
      <GroupLabel title={t('settingsPages.groupHelp')} />
      {group(<>
        <SettingRow icon={<IconTile name="shield" tone="mint" />} title={t('ui.privacy')} onPress={() => router.push('/privacy')} />
        <SettingRow icon={<IconTile name="comment" tone="blue" />} title={t('supportChat.rowTitle')} right={supportUnread ? <View accessible={false} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} /> : undefined} chevron onPress={() => router.push('/support')} last />
      </>)}
    </View>

    {PRO_ENABLED ? <View style={{ gap: 6 }}>
      <GroupLabel title={t('ui.groupFocus')} />
      {group(<>
        <SettingRow icon={<IconTile name="lock" tone="accent" />} title={t('strict')} right={strictActive ? <Pill label={t('active')} variant="success" /> : undefined} chevron onPress={() => router.push('/strict-mode')} />
        <SettingRow icon={<IconTile name="calendar" tone="blue" />} title={t('schedules')} onPress={() => router.push('/schedule')} />
        <SettingRow icon={<IconTile name="key" tone="mint" />} title={t('design.permissions')} onPress={() => router.push('/permissions')} />
        <SettingRow icon={<IconTile name="shieldCheck" tone="mint" />} title={t('design.protectionStatus')} right={<Pill label={t(nativeStatus.active ? 'active' : 'off')} variant={nativeStatus.active ? 'success' : 'muted'} />} chevron onPress={() => router.push('/protection')} last />
      </>)}
    </View> : null}

    <View style={{ alignItems: 'center', gap: 8, paddingTop: 6 }}>
      <FocusLogo size={40} glow={false} />
      <Text style={{ color: c.text3, fontSize: 13, fontWeight: '700' }}>Vaqtim · {t('settingsPages.version', { version })}</Text>
    </View>
  </Screen>;
}
