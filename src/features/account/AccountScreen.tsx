import { useAppStore } from '../../store/appStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { ActionButton, Card, GroupLabel, Heading, IconTile, Note, Screen, SettingRow } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../settings/components';
import { useAppTheme } from '../../theme';
import { useAccountStore } from '../../store/accountStore';
import { accountApi, accountSession, forgetAccountSession, isBackendConfigured, signOutAccount } from '../../services/backend/accountSession';
import { updatePassword } from '../../services/backend/authentication';
import { leaveAuth, AuthField, MIN_PASSWORD_LENGTH } from '../auth/components';
import { accountErrorKey } from './errors';
import { PostHogMaskView } from 'posthog-react-native';

function useAccountAction() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false), locked = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try { await action(); }
    catch (error) { const key = accountErrorKey(error); if (key) Alert.alert(t('cloudAuth.title'), t(key)); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  return { busy, run };
}
function Body({ children }: { children: string }) { const c = useAppTheme(); return <Text style={{ color: c.text2, fontSize: 15, lineHeight: 22, fontWeight: '500' }}>{children}</Text>; }

/** Card title with a leading icon tile, as on the Settings screen. */
function CardHeader({ icon, tone, title, subtitle }: { icon: Parameters<typeof IconTile>[0]['name']; tone: Parameters<typeof IconTile>[0]['tone']; title: string; subtitle?: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
    <IconTile name={icon} tone={tone} size={44} />
    <View style={{ flex: 1, paddingTop: 2 }}><Heading size="card" title={title} subtitle={subtitle} /></View>
  </View>;
}

/** Initials on the brand gradient; a key glyph when there is no name or email yet. */
export function Avatar({ label }: { label: string }) {
  const c = useAppTheme();
  const initials = label.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('');
  return <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundImage: c.grad }}>
    {initials ? <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.4 }}>{initials}</Text> : <Icon name="key" size={24} color="#FFFFFF" strokeWidth={2} />}
  </View>;
}

export function AccountScreen() {
  const { t } = useTranslation();
  const { user, ready, recoveryRequired } = useAccountStore();
  useEffect(() => { void accountSession.initialize().catch(() => undefined); }, []);
  return <PostHogMaskView style={{ flex: 1 }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Screen>
    <PageHeader back={!recoveryRequired} icon="key" tone="blue" title={t('cloudAuth.title')} subtitle={t('cloudAuth.intro')} />
    {!isBackendConfigured() ? <Card><Body>{t('cloudAuth.unavailable')}</Body></Card> : !ready ? <ActivityIndicator accessibilityLabel={t('cloudAuth.loading')} /> : user && recoveryRequired ? <ResetPasswordForm /> : user ? <SignedInAccount key={user.id} userId={user.id} /> : <SignedOutAccount />}
    <Note tone="accent" icon="shieldCheck">{t('cloudAuth.localNote')}</Note>
  </Screen></KeyboardAvoidingView></PostHogMaskView>;
}

function SignedOutAccount() {
  const { t } = useTranslation();
  return <Card style={{ gap: 20 }}>
    <CardHeader icon="key" tone="blue" title={t('cloudAuth.signedOutTitle')} subtitle={t('cloudAuth.signedOutBody')} />
    <View style={{ gap: 10 }}>
      <ActionButton title={t('cloudAuth.signIn')} onPress={() => router.push('/auth/sign-in')} />
      <ActionButton secondary title={t('cloudAuth.signUp')} onPress={() => router.push('/auth/sign-up')} />
    </View>
  </Card>;
}

/** Shown after a recovery code was verified: the session is valid only for setting a new password. */
function ResetPasswordForm() {
  const { t } = useTranslation();
  const { busy, run } = useAccountAction();
  const [password, setPassword] = useState(''), [repeat, setRepeat] = useState('');
  const submit = () => {
    if (password.length < MIN_PASSWORD_LENGTH) { Alert.alert(t('cloudAuth.title'), t('cloudAuth.passwordHint')); return; }
    if (password !== repeat) { Alert.alert(t('cloudAuth.title'), t('cloudAuth.passwordMismatch')); return; }
    void run(async () => { await updatePassword(password); setPassword(''); setRepeat(''); Alert.alert(t('cloudAuth.title'), t('cloudAuth.passwordUpdated')); leaveAuth(!useAppStore.getState().onboardingCompleted); });
  };
  return <Card style={{ gap: 18 }}>
    <CardHeader icon="lock" tone="accent" title={t('cloudAuth.resetTitle')} subtitle={t('cloudAuth.passwordHint')} />
    <View style={{ gap: 14 }}>
      <AuthField disabled={busy} label={t('cloudAuth.newPassword')} value={password} onChange={setPassword} kind="password" newPassword />
      <AuthField disabled={busy} label={t('cloudAuth.repeatPassword')} value={repeat} onChange={setRepeat} kind="password" newPassword onSubmit={submit} />
    </View>
    <View style={{ gap: 6 }}>
      <ActionButton title={t(busy ? 'cloudAuth.loading' : 'save')} disabled={busy || !password || !repeat} onPress={submit} />
      <ActionButton ghost disabled={busy} title={t('cloudAuth.signOut')} onPress={() => { void run(async () => { await signOutAccount(); }); }} />
    </View>
  </Card>;
}

function SignedInAccount({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const user = useAccountStore((state) => state.user);
  const { busy, run } = useAccountAction();
  const [name, setName] = useState(''), [loading, setLoading] = useState(true), [deleteText, setDeleteText] = useState('');
  const mounted = useRef(true);
  const sameAccount = useCallback(() => mounted.current && accountSession.getState().user?.id === userId, [userId]);
  useEffect(() => {
    mounted.current = true;
    // Settings back up automatically (services/backend/settingsSyncRuntime); this page only edits the profile.
    void accountApi().getAccount().then((account) => { if (sameAccount() && account.id === userId) setName(account.profile.displayName); })
      .catch(() => undefined).finally(() => { if (sameAccount()) setLoading(false); });
    return () => { mounted.current = false; };
  }, [sameAccount, userId]);
  const confirm = (title: string, body: string, action: () => Promise<void>, destructive = false) => Alert.alert(t(title), t(body), [{ text: t('cancel'), style: 'cancel' }, { text: t(destructive ? 'delete' : 'continue'), style: destructive ? 'destructive' : 'default', onPress: () => { void run(action); } }]);
  const unavailable = busy || loading;
  const signOut = () => confirm('cloudAuth.signOutConfirm', 'cloudAuth.signOutDescription', async () => { if (!(await signOutAccount())) Alert.alert(t('cloudAuth.title'), t('cloudAuth.signOutLocal')); });
  return <>
    <Card style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar label={name.trim() || user?.email || ''} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.36 }}>{name.trim() || t('cloudAuth.profile')}</Text>
          <Text numberOfLines={1} style={{ color: c.text2, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{user?.email || t('cloudAuth.accountNoEmail')}</Text>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <AuthField disabled={unavailable} label={t('cloudAuth.name')} value={name} onChange={setName} maxLength={80} />
        <ActionButton secondary compact disabled={unavailable} title={t('save')} onPress={() => { void run(async () => { await accountApi().saveProfile(name.trim()); }); }} />
      </View>
    </Card>

    <View style={{ gap: 8 }}>
      <GroupLabel title={t('ui.groupAccount')} />
      <View style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, opacity: busy ? 0.5 : 1 }}>
        <SettingRow icon={<IconTile name="lock" tone="neutral" />} title={t('cloudAuth.signOut')} onPress={busy ? undefined : signOut} chevron last />
      </View>
    </View>

    <Card style={{ gap: 18, borderWidth: 1, borderColor: c.redSoft }}>
      <CardHeader icon="close" tone="red" title={t('cloudAuth.deleteAccount')} subtitle={t('cloudAuth.deleteAccountDescription')} />
      <View style={{ gap: 12 }}>
        <AuthField disabled={busy} label={t('cloudAuth.deleteAccountHint')} value={deleteText} onChange={setDeleteText} maxLength={6} />
        <ActionButton variant="destructive" disabled={busy || deleteText !== 'DELETE'} title={t('cloudAuth.deleteAccount')} onPress={() => confirm('cloudAuth.deleteAccountConfirm', 'cloudAuth.deleteAccountDescription', async () => { await accountApi().deleteAccount(); await forgetAccountSession(); }, true)} />
      </View>
    </Card>
  </>;
}
