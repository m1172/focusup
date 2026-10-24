import { Alert, Platform } from 'react-native';
import i18n from '../../i18n';
import { protectionBridge } from '../../services/protection/nativeBridge';
import { reconcileProtection, resetProtectionController } from '../../services/protection/controller';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import type { SocialAppId } from '../../types/app';
import type { NativeProtectionStatus } from '../../services/protection/types';

/** `active` means FocusUp can block the original app: permission granted and, on iOS, the app picked in Apple's list. */
export type NativeBlockState = 'unsupported' | 'needsPermission' | 'needsSelection' | 'active';

/** Android identifies the app by package, so only iOS needs a selection. */
export function nativeBlockState(status: NativeProtectionStatus, appId: SocialAppId): NativeBlockState {
  if (!status.supported) return 'unsupported';
  if (!status.authorized) return 'needsPermission';
  if (Platform.OS !== 'ios') return 'active';
  // Builds before `selectedPlatforms` only report apps the current plan protects.
  return (status.selectedPlatforms ?? status.protectedPlatforms)?.includes(appId) ? 'active' : 'needsSelection';
}

const confirm = (title: string, message: string, action: string) => new Promise<boolean>((resolve) => {
  Alert.alert(title, message, [
    { text: i18n.t('subscription.notNow'), style: 'cancel', onPress: () => resolve(false) },
    { text: action, onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) });
});

async function refreshStatus() {
  const status = await protectionBridge.getStatus();
  useProtectionStatusStore.getState().setStatus(status);
  return status;
}

/**
 * Asks for system permission and, on iOS, the app selection that lets FocusUp block the original app.
 * Android finishes in system Accessibility settings, so it returns `needsPermission` while the user is there.
 * `cancelled` means the user said no to FocusUp's explanation or Apple's picker.
 */
export async function setUpNativeAppBlock(appId: SocialAppId, name: string, options: { feature?: string } = {}): Promise<NativeBlockState | 'cancelled'> {
  let status = await refreshStatus();
  const state = nativeBlockState(status, appId);
  if (state === 'unsupported' || state === 'active') return state;
  // Turning a filter on explains why the app gets blocked; the settings card only names the step.
  const title = i18n.t(options.feature ? 'browser.nativeBlockFirst' : 'wellbeing.disclosureTitle', { name });
  const reason = options.feature ? `${i18n.t('browser.nativeBlockFirstBody', { name, feature: options.feature })}\n\n` : '';
  if (state === 'needsPermission') {
    const steps = i18n.t(Platform.OS === 'ios' ? 'browser.nativeBlockIOSSteps' : 'browser.nativeBlockAndroidSteps', { name });
    const disclosure = i18n.t(Platform.OS === 'ios' ? 'wellbeing.disclosureIOS' : 'wellbeing.disclosureAndroid');
    if (!await confirm(title, `${reason}${steps}\n\n${disclosure}`, i18n.t('wellbeing.authorize'))) return 'cancelled';
    if (!await protectionBridge.requestAuthorization()) return 'needsPermission';
    status = await refreshStatus();
    if (!status.authorized) return 'needsPermission';
  } else if (!await confirm(title, `${reason}${i18n.t('browser.nativeBlockChoose', { name })}`, i18n.t('browser.nativeBlockChooseAction'))) return 'cancelled';
  // A picked app is ready even when the status cannot say so yet (builds before `selectedPlatforms`).
  let picked = false;
  if (nativeBlockState(status, appId) === 'needsSelection') {
    if (await protectionBridge.selectApps(appId) === 0) { await refreshStatus(); return 'cancelled'; }
    picked = true;
  }
  resetProtectionController();
  await reconcileProtection();
  const next = nativeBlockState(await refreshStatus(), appId);
  return picked && next === 'needsSelection' ? 'active' : next;
}

/** Android: the filter waits while the user turns on the Accessibility service, then turns on when FocusUp returns. */
let pendingEnable: { appId: SocialAppId; enable: () => void; until: number } | null = null;
useProtectionStatusStore.subscribe(({ status }) => {
  if (!pendingEnable) return;
  if (Date.now() > pendingEnable.until) { pendingEnable = null; return; }
  if (nativeBlockState(status, pendingEnable.appId) !== 'active') return;
  const { enable } = pendingEnable;
  pendingEnable = null;
  enable();
});

/**
 * Reels/Shorts blocking requires blocking the original app first. Calls `enable` once FocusUp can block it,
 * or right away on builds that cannot block other apps (Expo Go, simulators), where only the in-app filter exists.
 */
export async function enableAfterNativeBlock(appId: SocialAppId, name: string, feature: string, enable: () => void): Promise<void> {
  pendingEnable = null;
  const state = await setUpNativeAppBlock(appId, name, { feature });
  if (state === 'active' || state === 'unsupported') { enable(); return; }
  if (state === 'needsPermission' && Platform.OS === 'android') pendingEnable = { appId, enable, until: Date.now() + 10 * 60_000 };
}
