import { useCallback, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { ActionButton, Note, Screen } from '../../components/ui';
import { PageHeader, Panel } from '../../features/settings/components';
import { appNames, formatClock, timeAgo } from '../../features/family/format';
import { appCatalog } from '../../features/apps/catalog';
import { ensureNativeAuthorization, nativeBlockState, setUpNativeAppBlock } from '../../features/protection/nativeAppSetup';
import { protectionBridge } from '../../services/protection/nativeBridge';
import { endSupervisionAsAdult, syncFamilyDevice } from '../../services/family/deviceSync';
import { ageBand, BROWSER_APPS } from '../../services/family/policy';
import { familyBlockedApps, familyRequiredApps, nextDowntimeBoundary } from '../../services/family/resolver';
import { currentSupervisionRules, useFamilyStore } from '../../store/familyStore';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import { useAppTheme } from '../../theme';

/** Child's phone: who supervises it, the current rules, and the steps that make them work here. */
export default function SupervisedScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const supervision = useFamilyStore((state) => state.supervision);
  const lastSyncAt = useFamilyStore((state) => state.lastSyncAt);
  const status = useProtectionStatusStore((state) => state.status);
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    void protectionBridge.getStatus().then((value) => useProtectionStatusStore.getState().setStatus(value));
    void syncFamilyDevice();
  }, []));
  const rules = currentSupervisionRules();
  if (!supervision || !rules) return <Screen><PageHeader icon="shieldCheck" title={t('family.parent.title')} /></Screen>;

  const parent = supervision.parentName || t('family.child.yourParent');
  const band = ageBand(supervision.birthDate);
  const required = familyRequiredApps(rules);
  const needsPermission = required.length > 0 && required.some((app) => nativeBlockState(status, app, true) === 'needsPermission');
  const toChoose = Platform.OS === 'ios' && !needsPermission ? required.filter((app) => nativeBlockState(status, app, true) === 'needsSelection') : [];
  const unsupported = !status.supported;
  const browsers = BROWSER_APPS.filter((app) => rules.policy.browsers[app]?.enabled);
  const boundary = nextDowntimeBoundary(rules);
  const synced = timeAgo(t, lastSyncAt);

  const afterSetup = () => { void syncFamilyDevice(); };
  const allow = () => {
    setBusy(true);
    void ensureNativeAuthorization().then(afterSetup).catch(() => Alert.alert(t('family.child.setupTitle'), t('wellbeing.failed'))).finally(() => setBusy(false));
  };
  const choose = (app: (typeof required)[number]) => {
    setBusy(true);
    void setUpNativeAppBlock(app, appCatalog[app].name, { confirmed: true }).then(afterSetup).catch(() => Alert.alert(t('family.child.setupTitle'), t('wellbeing.failed'))).finally(() => setBusy(false));
  };
  const end = () => Alert.alert(t('family.child.endTitle'), t('family.child.endBody'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('family.child.endSupervision'), style: 'destructive', onPress: () => {
      setBusy(true);
      void endSupervisionAsAdult().then(() => router.replace('/start')).catch(() => Alert.alert(t('family.child.endSupervision'), t('family.child.endFailed'))).finally(() => setBusy(false));
    } },
  ]);

  return <Screen contentStyle={{ gap: 18 }}>
    <PageHeader icon="shieldCheck" tone="mint" title={t('family.child.supervisedBy', { parent })} subtitle={synced ? t('family.child.lastSync', { time: synced }) : t('family.child.neverSynced')} />

    {unsupported ? <Note tone="red" icon="info">{t('wellbeing.nativeUnavailable')}</Note> : needsPermission || toChoose.length ? <Panel label={t('family.child.setupTitle')}>
      <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>{t('family.child.setupBody')}</Text>
      <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>{t(Platform.OS === 'ios' ? 'family.child.setupIOS' : 'family.child.setupAndroid')}</Text>
      {needsPermission ? <ActionButton title={t('family.child.setupAction')} disabled={busy} onPress={allow} /> : null}
      {toChoose.map((app) => <ActionButton key={app} compact secondary title={t('family.child.chooseApp', { name: appCatalog[app].name })} disabled={busy} onPress={() => choose(app)} />)}
    </Panel> : required.length ? <Note tone="mint" icon="shieldCheck">{t('family.child.setupDone')}</Note> : null}

    <Panel label={t('family.child.rulesTitle')}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}>{t('family.child.blockedApps')}</Text>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>{familyBlockedApps(rules).length ? appNames(familyBlockedApps(rules)) : t('family.child.noBrowsers')}</Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}>{t('family.child.browsersTitle')}</Text>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>{band === 'child' ? t('family.child.under13') : browsers.length ? appNames(browsers) : t('family.child.noBrowsers')}</Text>
      </View>
      {band !== 'child' && browsers.some((app) => rules.policy.limits?.[app]) ? <View style={{ gap: 4 }}>
        <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}>{t('family.child.limitsTitle')}</Text>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>{browsers.filter((app) => rules.policy.limits?.[app]).map((app) => `${appCatalog[app].name} · ${t('family.rules.minutes', { count: rules.policy.limits![app]! })}`).join(', ')}</Text>
      </View> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="moon" size={20} color={c.accent} strokeWidth={2.2} />
        <Text style={{ flex: 1, color: c.text, fontSize: 15, fontWeight: '600' }}>{boundary ? t(boundary.kind === 'start' ? 'family.child.downtimeStarts' : 'family.child.downtimeEnds', { time: `${formatClock(boundary.at)}${boundary.at.toDateString() === new Date().toDateString() ? '' : ` · ${(t('family.weekdays', { returnObjects: true }) as string[])[boundary.at.getDay()]}`}` }) : t('family.child.noDowntime')}</Text>
      </View>
    </Panel>

    <Panel label={t('family.child.privacyTitle')}>
      <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>{t('family.child.privacyShared')}</Text>
      <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>{t('family.child.privacyNotShared')}</Text>
    </Panel>

    {band === 'adult' ? <ActionButton variant="destructive" title={t('family.child.endSupervision')} disabled={busy} onPress={end} /> : null}
  </Screen>;
}
