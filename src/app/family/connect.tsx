import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { ActionButton, Note, Screen } from '../../components/ui';
import { PageHeader, Panel } from '../../features/settings/components';
import { BigCode, FamilyField } from '../../features/family/components';
import { BackendError } from '../../services/backend/client';
import { shutDownProductAnalytics } from '../../services/analytics/productAnalytics';
import { cancelPendingPairing, claimFamilyCode, syncFamilyDevice } from '../../services/family/deviceSync';
import { useFamilyStore } from '../../store/familyStore';
import { useAppTheme } from '../../theme';

/** Shown as ABCD-EFGH while typing; look-alike characters are not used in codes. */
function formatCode(value: string) {
  const clean = value.toUpperCase().replace(/[^A-HJKMNP-Z2-9]/g, '').slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** Child's phone: enter the parent's code, read what supervision means, then show the confirmation code. */
export default function FamilyConnectScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const role = useFamilyStore((state) => state.role);
  const pending = useFamilyStore((state) => state.pending);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No analytics from the moment this phone starts down the child path.
  useEffect(() => { useFamilyStore.getState().chooseChildPath(); void shutDownProductAnalytics(); }, []);
  useEffect(() => { if (role === 'child') router.replace('/family/supervised'); }, [role]);
  // Waiting for the parent: check every few seconds.
  useEffect(() => {
    if (role !== 'pending') return undefined;
    const timer = setInterval(() => { void syncFamilyDevice(); }, 3000);
    return () => clearInterval(timer);
  }, [role]);

  const connect = () => {
    setBusy(true); setError(null);
    void claimFamilyCode(code).then(() => setCode('')).catch((failure) => {
      const closed = failure instanceof BackendError && (failure.code === 'FAMILY_ENROLLMENT_CLOSED' || failure.code === 'FAMILY_UNAVAILABLE');
      setError(t(closed ? 'family.child.closed' : failure instanceof BackendError && failure.code === 'NETWORK_ERROR' ? 'family.parent.loadFailed' : 'family.child.invalidCode'));
    }).finally(() => setBusy(false));
  };
  const cancel = () => { void cancelPendingPairing().finally(() => { if (router.canGoBack()) router.back(); else router.replace('/start'); }); };

  if (role === 'pending') return <Screen contentStyle={{ gap: 18 }}>
    <PageHeader icon="link" tone="blue" back={false} title={t('family.child.waitingTitle')} subtitle={t('family.child.waitingBody', { parent: pending?.parentName || t('family.child.yourParent') })} />
    {pending ? <BigCode code={pending.confirmationCode} label={t('family.child.confirmationLabel')} /> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}><ActivityIndicator /></View>
    <ActionButton variant="outline" title={t('family.child.cancel')} onPress={cancel} />
  </Screen>;

  const valid = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/.test(code);
  return <Screen contentStyle={{ gap: 18 }}>
    <PageHeader icon="link" tone="blue" title={t('family.child.connectTitle')} subtitle={t('family.child.connectBody')} />
    <Panel>
      <FamilyField label={t('family.child.codeLabel')} placeholder="ABCD-EFGH" value={code} onChangeText={(value) => { setError(null); setCode(formatCode(value)); }}
        autoCapitalize="characters" autoCorrect={false} autoComplete="off" textContentType="none" maxLength={9} style={{ fontSize: 26, letterSpacing: 4, textAlign: 'center' }} />
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: c.red, fontSize: 14, fontWeight: '600' }}>{error}</Text> : null}
    </Panel>
    <Panel label={t('family.child.noticeTitle')}>
      {(t('family.child.noticePoints', { returnObjects: true }) as string[]).map((point) => <View key={point} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="info" size={19} color={c.accent} strokeWidth={2.2} />
        <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{point}</Text>
      </View>)}
    </Panel>
    <Note tone="mint" icon="eyeOff">{t('family.child.privacyNoAnalytics')}</Note>
    <ActionButton title={busy ? t('cloudAuth.loading') : t('family.child.noticeAgree')} disabled={!valid || busy} onPress={connect} />
  </Screen>;
}
