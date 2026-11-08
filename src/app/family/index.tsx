import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { ActionButton, Note, Pill, Screen, Toggle } from '../../components/ui';
import { PageHeader, Panel, PanelRow } from '../../features/settings/components';
import { familyErrorMessage, runSensitive, useFamilyParentStore } from '../../features/family/parentData';
import { timeAgo } from '../../features/family/format';
import { accountApi } from '../../services/backend/accountSession';
import { childState, statusVariant } from '../../features/family/status';
import { ageOn } from '../../services/family/policy';
import { useAppTheme } from '../../theme';

export default function FamilyScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const overview = useFamilyParentStore((state) => state.overview);
  const failed = useFamilyParentStore((state) => state.failed);
  const load = useFamilyParentStore((state) => state.load);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const setUp = (country: string) => {
    if (!overview) return;
    setBusy(true);
    void accountApi().setUpFamily(country, overview.consentVersion).then(() => load())
      .catch((error) => Alert.alert(t('family.parent.title'), familyErrorMessage(error))).finally(() => setBusy(false));
  };
  const deleteFamily = () => Alert.alert(t('family.parent.deleteFamilyTitle'), t('family.parent.deleteFamilyBody'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('family.parent.deleteAction'), style: 'destructive', onPress: () => {
      setBusy(true);
      void runSensitive(() => accountApi().deleteFamily()).then((done) => done ? load() : undefined)
        .catch((error) => Alert.alert(t('family.parent.deleteFamily'), familyErrorMessage(error))).finally(() => setBusy(false));
    } },
  ]);

  const header = <PageHeader icon="shieldCheck" tone="mint" title={t('family.parent.title')} subtitle={t('family.parent.subtitle')} />;
  if (!overview) return <Screen contentStyle={{ gap: 18 }}>
    {header}
    {failed ? <Panel><Text style={{ color: c.text2, fontSize: 15 }}>{t('family.parent.loadFailed')}</Text><ActionButton compact secondary title={t('family.parent.retry')} onPress={() => { void load(); }} /></Panel>
      : <ActivityIndicator accessibilityLabel={t('cloudAuth.loading')} />}
  </Screen>;

  if (!overview.family) {
    const country = overview.countries[0] ?? 'UZ';
    const countryName = (t(`family.parent.countries.${country}`, { defaultValue: country }) as string);
    return <Screen contentStyle={{ gap: 18 }}>
      {header}
      <Panel label={t('family.parent.introTitle')}>
        {(t('family.parent.introPoints', { returnObjects: true }) as string[]).map((point) => <View key={point} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="circleCheck" size={20} color={c.mint} strokeWidth={2.2} />
          <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{point}</Text>
        </View>)}
      </Panel>
      <Panel label={t('family.parent.notIncludedTitle')}><Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>{t('family.parent.notIncluded')}</Text></Panel>
      <Panel label={t('family.parent.consentTitle')}>
        <Text style={{ color: c.text, fontSize: 14, lineHeight: 21 }}>{t('family.parent.consentBody')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21, fontWeight: '700' }}>{t('family.parent.consentCheck')}</Text>
          <Toggle label={t('family.parent.consentCheck')} value={agreed} onChange={setAgreed} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ color: c.text2, fontSize: 14, fontWeight: '600' }}>{t('family.parent.countryLabel')}</Text>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{countryName}</Text>
        </View>
      </Panel>
      {!overview.enrollmentOpen ? <Note tone="amber" icon="info">{t('family.parent.closed')}</Note> : null}
      <ActionButton title={t('family.parent.setUp')} disabled={!agreed || busy || !overview.enrollmentOpen} onPress={() => setUp(country)} />
    </Screen>;
  }

  return <Screen contentStyle={{ gap: 18 }}>
    {header}
    <Panel label={t('family.parent.childrenLabel')} padded={false}>
      {overview.children.length ? overview.children.map((child, index) => {
        const state = childState(child);
        const seen = child.device ? timeAgo(t, child.device.lastSeenAt) : null;
        return <PanelRow key={child.id} icon="shield" tone={state === 'applied' ? 'mint' : state === 'unavailable' ? 'red' : 'accent'} title={child.nickname}
          subtitle={`${t('family.rules.age', { count: ageOn(child.birthDate) })} · ${seen ? t('family.parent.lastContact', { time: seen }) : t('family.parent.neverContacted')}`}
          right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Pill label={t(`family.status.${state}`)} variant={statusVariant[state]} /><Icon name="chevron" size={18} color={c.text3} strokeWidth={2.2} /></View>}
          onPress={() => router.push({ pathname: '/family/child/[childId]', params: { childId: child.id } })} last={index === overview.children.length - 1} />;
      }) : <Text style={{ color: c.text2, fontSize: 15, paddingVertical: 18 }}>{t('family.parent.noChildren')}</Text>}
    </Panel>
    {!overview.enrollmentOpen ? <Note tone="amber" icon="info">{t('family.parent.closed')}</Note> : null}
    <ActionButton title={t('family.parent.addChild')} disabled={!overview.enrollmentOpen || overview.children.length >= 8} onPress={() => router.push('/family/add-child')} />
    <ActionButton variant="destructive" title={t('family.parent.deleteFamily')} disabled={busy} onPress={deleteFamily} />
  </Screen>;
}
