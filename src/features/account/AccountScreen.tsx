import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { ActionButton, BackButton, Card, Heading, Screen } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { useAccountStore } from '../../store/accountStore';
import { accountApi, accountSession, forgetAccountSession, isBackendConfigured, signOutAccount } from '../../services/backend/accountSession';
import { updatePassword } from '../../services/backend/authentication';
import { captureSettingsBackup } from '../../services/backend/settingsBackup';
import { restoreCloudSettings } from '../../services/backend/restoreSettings';
import { isCloudBackup } from '../../services/backend/settingsValidation';
import { exportAccountFile } from '../../services/backend/exportAccount';
import { BackendError } from '../../services/backend/client';
import type { CloudBackup } from '../../services/backend/types';
import { AuthField, MIN_PASSWORD_LENGTH } from '../auth/components';
import { accountErrorKey } from './errors';

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
function Note({ children }: { children: string }) { const c = useAppTheme(); return <Text style={{ color: c.text2, lineHeight: 22 }}>{children}</Text>; }

export function AccountScreen() {
  const { t } = useTranslation();
  const { user, ready, recoveryRequired } = useAccountStore();
  useEffect(() => { void accountSession.initialize().catch(() => undefined); }, []);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Screen>
    <BackButton label={t('back')} /><Heading title={t('cloudAuth.title')} subtitle={t('cloudAuth.intro')} />
    {!isBackendConfigured() ? <Card><Note>{t('cloudAuth.unavailable')}</Note></Card> : !ready ? <ActivityIndicator accessibilityLabel={t('cloudAuth.loading')} /> : user && recoveryRequired ? <ResetPasswordForm /> : user ? <SignedInAccount key={user.id} userId={user.id} /> : <SignedOutAccount />}
    <Note>{t('cloudAuth.localNote')}</Note>
  </Screen></KeyboardAvoidingView>;
}

function SignedOutAccount() {
  const { t } = useTranslation();
  return <Card><Heading size="card" title={t('cloudAuth.signedOutTitle')} subtitle={t('cloudAuth.signedOutBody')} />
    <ActionButton title={t('cloudAuth.signIn')} onPress={() => router.push('/auth/sign-in')} />
    <ActionButton secondary title={t('cloudAuth.signUp')} onPress={() => router.push('/auth/sign-up')} />
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
    void run(async () => { await updatePassword(password); setPassword(''); setRepeat(''); Alert.alert(t('cloudAuth.title'), t('cloudAuth.passwordUpdated')); });
  };
  return <Card><Heading size="card" title={t('cloudAuth.resetTitle')} />
    <AuthField disabled={busy} label={t('cloudAuth.newPassword')} value={password} onChange={setPassword} kind="password" newPassword />
    <Note>{t('cloudAuth.passwordHint')}</Note>
    <AuthField disabled={busy} label={t('cloudAuth.repeatPassword')} value={repeat} onChange={setRepeat} kind="password" newPassword onSubmit={submit} />
    <ActionButton title={t(busy ? 'cloudAuth.loading' : 'save')} disabled={busy || !password || !repeat} onPress={submit} />
    <ActionButton ghost disabled={busy} title={t('cloudAuth.signOut')} onPress={() => { void run(async () => { await signOutAccount(); }); }} />
  </Card>;
}

function SignedInAccount({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const user = useAccountStore((state) => state.user);
  const { busy, run } = useAccountAction();
  const [name, setName] = useState(''), [cloud, setCloud] = useState<CloudBackup | null>(null), [loading, setLoading] = useState(true), [loadFailed, setLoadFailed] = useState(false), [deleteText, setDeleteText] = useState('');
  const mounted = useRef(true);
  const sameAccount = useCallback(() => mounted.current && accountSession.getState().user?.id === userId, [userId]);
  const requestCloud = useCallback(async () => {
    const [account, backup] = await Promise.all([accountApi().getAccount(), accountApi().getSettings()]);
    if (account.id !== userId || !isCloudBackup(backup)) throw new BackendError(400, 'INVALID_BACKUP', 'Invalid cloud response.');
    return { account, backup };
  }, [userId]);
  const load = useCallback(() => requestCloud().then(({ account, backup }) => {
      if (!sameAccount()) return;
      setName(account.profile.displayName); setCloud(backup); setLoadFailed(false);
    }).catch((error: unknown) => { if (sameAccount()) setLoadFailed(true); throw error; })
    .finally(() => { if (sameAccount()) setLoading(false); }), [sameAccount, requestCloud]);
  useEffect(() => { mounted.current = true; void load().catch(() => undefined); return () => { mounted.current = false; }; }, [load]);
  const confirm = (title: string, body: string, action: () => Promise<void>, destructive = false) => Alert.alert(t(title), t(body), [{ text: t('cancel'), style: 'cancel' }, { text: t(destructive ? 'delete' : 'continue'), style: destructive ? 'destructive' : 'default', onPress: () => { void run(action); } }]);
  const unavailable = busy || loading;
  return <>
    <Card><Heading size="card" title={t('cloudAuth.profile')} /><Note>{user?.email ?? t('cloudAuth.accountNoEmail')}</Note>
      <AuthField disabled={unavailable} label={t('cloudAuth.name')} value={name} onChange={setName} maxLength={80} />
      <ActionButton secondary disabled={unavailable} title={t('save')} onPress={() => { void run(async () => { await accountApi().saveProfile(name.trim()); }); }} />
    </Card>
    <Card><Heading size="card" title={t('cloudAuth.backupTitle')} subtitle={t('cloudAuth.backupDescription')} />
      {loading ? <ActivityIndicator accessibilityLabel={t('cloudAuth.loading')} /> : loadFailed ? <Note>{t('cloudAuth.networkError')}</Note> : <Note>{cloud?.payload && cloud.updatedAt ? t('cloudAuth.backupDate', { date: new Date(cloud.updatedAt).toLocaleString(i18n.language) }) : t('cloudAuth.noBackup')}</Note>}
      <ActionButton disabled={unavailable || !cloud || loadFailed} title={t('cloudAuth.backupNow')} onPress={() => { const revision = cloud?.revision; if (revision === undefined) return; void run(async () => { const saved = await accountApi().saveSettings(revision, captureSettingsBackup()); if (sameAccount()) { setCloud(saved); Alert.alert(t('cloudAuth.title'), t('cloudAuth.backupSaved')); } }); }} />
      <ActionButton secondary disabled={unavailable || !cloud?.payload || loadFailed} title={t('cloudAuth.restore')} onPress={() => { const payload = cloud?.payload; if (payload) confirm('cloudAuth.restoreConfirm', 'cloudAuth.restoreDescription', async () => { if (!sameAccount()) return; await restoreCloudSettings(payload); Alert.alert(t('cloudAuth.title'), t('cloudAuth.restored')); }); }} />
      <ActionButton secondary disabled={unavailable} title={t('cloudAuth.refresh')} onPress={() => { setLoading(true); void run(load); }} />
      <ActionButton ghost disabled={unavailable || !cloud?.payload || loadFailed} title={t('cloudAuth.deleteBackup')} onPress={() => { const revision = cloud?.revision; if (revision !== undefined) confirm('cloudAuth.deleteBackupConfirm', 'cloudAuth.deleteBackupDescription', async () => { const deleted = await accountApi().deleteSettings(revision); if (sameAccount()) { setCloud(deleted); Alert.alert(t('cloudAuth.title'), t('cloudAuth.backupDeleted')); } }, true); }} />
    </Card>
    <Card><ActionButton secondary disabled={unavailable} title={t('cloudAuth.export')} onPress={() => { void run(exportAccountFile); }} />
      <ActionButton secondary disabled={busy} title={t('cloudAuth.signOut')} onPress={() => confirm('cloudAuth.signOutConfirm', 'cloudAuth.signOutDescription', async () => { if (!(await signOutAccount())) Alert.alert(t('cloudAuth.title'), t('cloudAuth.signOutLocal')); })} />
    </Card>
    <Card><Heading size="card" title={t('cloudAuth.deleteAccount')} subtitle={t('cloudAuth.deleteAccountDescription')} />
      <AuthField disabled={busy} label={t('cloudAuth.deleteAccountHint')} value={deleteText} onChange={setDeleteText} maxLength={6} />
      <ActionButton variant="destructive" disabled={busy || deleteText !== 'DELETE'} title={t('cloudAuth.deleteAccount')} onPress={() => confirm('cloudAuth.deleteAccountConfirm', 'cloudAuth.deleteAccountDescription', async () => { await accountApi().deleteAccount(); await forgetAccountSession(); }, true)} />
    </Card>
  </>;
}
