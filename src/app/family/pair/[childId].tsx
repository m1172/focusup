import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../components/Typography';
import { ActionButton, Note, Screen } from '../../../components/ui';
import { PageHeader, Panel } from '../../../features/settings/components';
import { BigCode, FamilyField } from '../../../features/family/components';
import { familyErrorMessage, runSensitive, useFamilyChild, useFamilyParentStore } from '../../../features/family/parentData';
import { accountApi } from '../../../services/backend/accountSession';
import { BackendError } from '../../../services/backend/client';
import { useAppTheme } from '../../../theme';

/** Parent's phone: show a single-use code, wait for the child's phone to enter it, then confirm the code it shows. */
export default function FamilyPairScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const child = useFamilyChild(childId);
  const load = useFamilyParentStore((state) => state.load);
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  // A code already claimed (for example after leaving this screen) goes straight to confirming; otherwise a code is requested.
  const [busy, setBusy] = useState(() => !child?.pairing?.claimed);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const started = useRef(false);
  const claimed = Boolean(child?.pairing?.claimed);

  const requestCode = () => {
    if (!childId) return;
    void accountApi().startFamilyPairing(childId).then((result) => setCode({ code: result.code, expiresAt: Date.parse(result.expiresAt) }))
      .then(() => load()).catch((error) => setMessage(familyErrorMessage(error))).finally(() => setBusy(false));
  };
  const start = () => { setBusy(true); setMessage(null); setConfirmation(''); requestCode(); };
  useEffect(() => {
    if (started.current || !childId) return;
    started.current = true;
    if (!child?.pairing?.claimed) requestCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);
  // Watch for the child's phone entering the code; stop once it has.
  useEffect(() => {
    if (claimed) return undefined;
    const timer = setInterval(() => { setNow(Date.now()); void load(); }, 3000);
    return () => clearInterval(timer);
  }, [claimed, load]);

  const expired = code ? code.expiresAt <= now : false;
  const approve = () => {
    if (!childId || !/^\d{6}$/.test(confirmation)) return;
    setBusy(true); setMessage(null);
    void runSensitive(() => accountApi().approveFamilyPairing(childId, confirmation)).then(async (result) => {
      if (!result) return;
      await load();
      router.back();
    }).catch(async (error) => {
      if (error instanceof BackendError && error.code === 'FAMILY_CONFIRMATION_MISMATCH') setMessage(t('family.pair.mismatch'));
      else { setMessage(familyErrorMessage(error)); await load(); setCode(null); }
    }).finally(() => setBusy(false));
  };
  const cancel = () => {
    if (childId) void accountApi().cancelFamilyPairing(childId).catch(() => undefined).finally(() => { void load(); });
    router.back();
  };

  return <Screen contentStyle={{ gap: 18 }}>
    <PageHeader icon="link" tone="blue" title={t('family.pair.title')} subtitle={claimed ? undefined : t('family.pair.subtitle')} />
    {claimed ? <Panel>
      <Text style={{ color: c.text, fontSize: 15, lineHeight: 22, fontWeight: '600' }}>{t('family.pair.claimed')}</Text>
      <FamilyField label={t('family.pair.confirmationLabel')} value={confirmation} onChangeText={(value) => setConfirmation(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" autoComplete="one-time-code" style={{ fontSize: 28, letterSpacing: 6, textAlign: 'center' }} />
      <ActionButton title={t('family.pair.approve')} disabled={busy || confirmation.length !== 6} onPress={approve} />
    </Panel> : code && !expired ? <>
      <BigCode code={code.code} label={t('family.pair.expiresIn', { minutes: Math.max(1, Math.ceil((code.expiresAt - now) / 60_000)) })} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator />
        <Text style={{ color: c.text2, fontSize: 15, fontWeight: '600' }}>{t('family.pair.waiting')}</Text>
      </View>
    </> : busy ? <ActivityIndicator /> : <Panel>
      {expired ? <Text style={{ color: c.text2, fontSize: 15 }}>{t('family.pair.expired')}</Text> : null}
      <ActionButton title={t('family.pair.newCode')} onPress={start} />
    </Panel>}
    {message ? <Note tone="amber" icon="info">{message}</Note> : null}
    {child?.device ? <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>{t('family.rules.replaceBody')}</Text> : null}
    <ActionButton variant="outline" title={t('family.pair.cancel')} onPress={cancel} />
  </Screen>;
}
