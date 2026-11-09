import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { Icon } from '../../components/Icon';
import { ActionButton, Screen } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { appCatalog } from '../apps/catalog';
import { currentSupervisionRules, useFamilyStore } from '../../store/familyStore';
import { isRemoteFeatureEnabled, useRemoteBlockerConfigStore } from '../../store/remoteBlockerConfigStore';
import { familyBrowserAccess, nextDowntimeBoundary, type BrowserAccess } from '../../services/family/resolver';
import type { SocialAppId } from '../../types/app';
import { formatClock } from './format';

/** Whether family rules let this browser open now. Re-checked at every downtime boundary, on return and each minute. */
export function useFamilyBrowserAccess(appId: SocialAppId): BrowserAccess {
  const supervision = useFamilyStore((state) => state.role === 'child' ? state.supervision : null);
  const remote = useRemoteBlockerConfigStore((state) => state.config);
  const compute = () => familyBrowserAccess(appId, currentSupervisionRules(), new Date(), (app, feature) => isRemoteFeatureEnabled(app, feature));
  const [access, setAccess] = useState<BrowserAccess>(compute);
  useEffect(() => {
    if (!supervision) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      setAccess(compute());
      if (timer) clearTimeout(timer);
      const boundary = nextDowntimeBoundary(currentSupervisionRules());
      // Wake exactly at the next boundary (plus a second), but at least once a minute in case the clock changed.
      const wait = boundary ? Math.min(60_000, Math.max(1_000, boundary.at.getTime() - Date.now() + 1_000)) : 60_000;
      timer = setTimeout(update, wait);
    };
    // The first state came from the initializer; re-check right after new rules or blocker settings arrive.
    timer = setTimeout(update, 0);
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') update(); });
    return () => { if (timer) clearTimeout(timer); appState.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, supervision, remote]);
  return supervision ? access : 'allowed';
}

/** Shown instead of the page when family rules close this browser. */
export function FamilyBrowserBlocked({ appId, reason }: { appId: SocialAppId; reason: Exclude<BrowserAccess, 'allowed'> }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const parentName = useFamilyStore((state) => state.supervision?.parentName || '');
  const boundary = reason === 'downtime' ? nextDowntimeBoundary(currentSupervisionRules()) : null;
  const name = appCatalog[appId]?.name ?? '';
  const leave = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); };
  return <Screen contentStyle={{ gap: 22, paddingTop: 40 }}>
    <View style={{ alignItems: 'center', gap: 14 }}>
      <View><AppIcon appId={appId} size={84} />
        <View style={{ position: 'absolute', right: -6, bottom: -6, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: reason === 'blockerUnavailable' ? c.redSoft : c.soft, borderWidth: 3, borderColor: c.background }}>
          <Icon name={reason === 'downtime' ? 'moon' : reason === 'blockerUnavailable' ? 'close' : 'lock'} size={18} color={reason === 'blockerUnavailable' ? c.red : c.ink} strokeWidth={2.4} />
        </View>
      </View>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center' }}>{t(`family.browser.${reason}Title`, { name })}</Text>
      <Text style={{ color: c.text2, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{t(`family.browser.${reason}Body`, { name, parent: parentName || t('family.child.yourParent') })}</Text>
      {boundary?.kind === 'end' ? <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>{t('family.browser.until', { time: formatClock(boundary.at) })}</Text> : null}
    </View>
    <ActionButton title={t('back')} onPress={leave} />
  </Screen>;
}
