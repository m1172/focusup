import { useState } from 'react';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BrowserLaunchScreen } from '../../features/webview/BrowserLaunchScreen';
import { BrowserLinkSheet } from '../../features/webview/BrowserLinkSheet';
import { socialBrowserHome } from '../../services/social-browser/navigation';
import { appCatalog } from '../../features/apps/catalog';
import { isCleanPlatform } from '../../types/social';
import { POST_MODE_MINUTES, postsLeft } from '../../services/protection/engine';
import { startPostMode } from '../../services/protection/controller';
import { openRealApp } from '../../services/protection/realApp';
import { isFamilyDevice } from '../../store/familyStore';
import { useWellbeingStore } from '../../store/wellbeingStore';

/** Entry point from a blocked original app. Opening the cleaner browser never removes its native shield. */
export default function NativeAppHandoffScreen() {
  const { appId, link } = useLocalSearchParams<{ appId: string; link?: string }>();
  // The shield's "Open a link" button arrives with the link box already open.
  const [showLinkSheet, setShowLinkSheet] = useState(link === '1');
  const { t } = useTranslation();
  const left = useWellbeingStore((state) => postsLeft(state.posts));
  const [posting, setPosting] = useState(false);
  if (!isCleanPlatform(appId)) return <Redirect href="/protection" />;
  const open = (url: string) => router.replace({ pathname: '/browser/[appId]', params: { appId, url } });
  const name = appCatalog[appId].name;
  const post = () => {
    setPosting(true);
    void startPostMode(appId).then(async () => { if (!await openRealApp(appId)) Alert.alert(t('browser.postModeTitle'), t('browser.postModeOpenFailed', { name })); })
      .catch((error: Error) => Alert.alert(t('browser.postModeTitle'), t(error.message === 'noPostsLeft' ? 'browser.postModeNone' : error.message === 'strictActive' ? 'browser.postModeStrict' : 'browser.postModeUnavailable', { name })))
      .finally(() => setPosting(false));
  };
  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: '#302538' }}>
    <Stack.Screen options={{ statusBarStyle: 'light' }} />
    {Platform.OS !== 'ios' ? <StatusBar style="light" /> : null}
    <BrowserLaunchScreen name={name} onOpen={() => open(socialBrowserHome[appId])}
      onOpenLink={() => setShowLinkSheet(true)} onLeave={() => router.replace('/(tabs)')}
      post={isFamilyDevice() ? undefined : { minutes: POST_MODE_MINUTES, left, busy: posting, onPress: post }} />
    <BrowserLinkSheet appId={appId} name={appCatalog[appId].name} visible={showLinkSheet}
      onClose={() => setShowLinkSheet(false)} onOpen={open} />
  </SafeAreaView>;
}
