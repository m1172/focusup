import { useState } from 'react';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BrowserLaunchScreen } from '../../features/webview/BrowserLaunchScreen';
import { BrowserLinkSheet } from '../../features/webview/BrowserLinkSheet';
import { socialBrowserHome } from '../../services/social-browser/navigation';
import { appCatalog } from '../../features/apps/catalog';

/** Entry point from a blocked original app. Opening the cleaner browser never removes its native shield. */
export default function NativeAppHandoffScreen() {
  const { appId, link } = useLocalSearchParams<{ appId: string; link?: string }>();
  // The shield's "Open a link" button arrives with the link box already open.
  const [showLinkSheet, setShowLinkSheet] = useState(link === '1');
  if (appId !== 'instagram' && appId !== 'youtube') return <Redirect href="/protection" />;
  const open = (url: string) => router.replace({ pathname: '/browser/[appId]', params: { appId, url } });
  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: '#302538' }}>
    <Stack.Screen options={{ statusBarStyle: 'light' }} />
    {Platform.OS !== 'ios' ? <StatusBar style="light" /> : null}
    <BrowserLaunchScreen name={appCatalog[appId].name} onOpen={() => open(socialBrowserHome[appId])}
      onOpenLink={() => setShowLinkSheet(true)} onLeave={() => router.replace('/(tabs)')} />
    <BrowserLinkSheet appId={appId} name={appCatalog[appId].name} visible={showLinkSheet}
      onClose={() => setShowLinkSheet(false)} onOpen={open} />
  </SafeAreaView>;
}
