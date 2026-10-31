import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { Text } from '../../components/Typography';
import { Pill } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import { protectionBridge } from '../../services/protection/nativeBridge';
import type { SocialAppId } from '../../types/app';
import { nativeBlockState, setUpNativeAppBlock } from './nativeAppSetup';

/** Status of the "Block the real app" switch: permission, Apple's app selection, and whether the block is active. */
export function NativeAppProtectionCard({ appId, name, feature, filterOn }: { appId: SocialAppId; name: string; feature: string; filterOn: boolean }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const status = useProtectionStatusStore((state) => state.status);
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void protectionBridge.getStatus().then((next) => { if (active) useProtectionStatusStore.getState().setStatus(next); });
    return () => { active = false; };
  }, []));
  const state = nativeBlockState(status, appId);
  // Expo Go, simulators and binaries without the native module cannot block other apps.
  if (state === 'unsupported') return null;
  const blocked = filterOn && state === 'active';
  const title = t(blocked ? 'browser.nativeBlockedTitle' : 'browser.blockOriginal', { name });
  const detail = !filterOn ? t('browser.nativeBlockOffSwitch')
    : state === 'active' ? t('browser.nativeBlockActive', { name })
      : state === 'needsSelection' ? t('browser.nativeBlockChoose', { name })
        : t('browser.nativeBlockSetup', { name, feature });
  // iOS lets the user re-pick the app; Android has nothing to change once the service is on.
  const actionable = filterOn && !busy && (state !== 'active' || Platform.OS === 'ios');
  const setUp = () => {
    setBusy(true);
    void setUpNativeAppBlock(appId, name)
      .catch(() => { Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed')); })
      .finally(() => setBusy(false));
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !actionable, busy }} disabled={!actionable}
    onPress={state === 'active' ? () => { setBusy(true); void protectionBridge.selectApps(appId).then(() => setUpNativeAppBlock(appId, name)).catch(() => undefined).finally(() => setBusy(false)); } : setUp}
    style={({ pressed }) => ({ padding: 16, borderRadius: 22, backgroundColor: c.soft, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: !filterOn ? 0.6 : pressed ? 0.7 : 1 })}>
    <Icon name="shieldCheck" size={26} color={blocked ? c.mintInk : c.ink} />
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: c.text2, fontSize: 12, lineHeight: 18 }}>{detail}</Text>
    </View>
    {filterOn ? <Pill label={t(blocked ? 'browser.nativeBlockOn' : state === 'needsSelection' ? 'browser.nativeBlockChooseAction' : 'browser.nativeBlockTurnOn')} active={blocked} variant={blocked ? undefined : 'primary'} /> : null}
  </Pressable>;
}
