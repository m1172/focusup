import { Platform, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { ScreenStatusBar } from '../../components/ScreenStatusBar';
import { appCatalog } from '../../features/apps/catalog';
import { useBrowserHostStore } from '../../store/browserHostStore';
import { useAppTheme } from '../../theme';
import type { SocialAppId } from '../../types/app';

/**
 * The page itself lives in the root BrowserLayer, which keeps it alive between opens and shows it while this
 * route is on top. This screen only holds the place in the stack (deep links, back, analytics) and the status bar.
 */
export default function BrowserScreen() {
  const { appId } = useLocalSearchParams<{ appId: string; url?: string }>();
  const app = appCatalog[appId as SocialAppId];
  const { t } = useTranslation();
  const c = useAppTheme();
  const statusBarHidden = useBrowserHostStore((state) => state.statusBarHidden);

  if (!app?.supported) return <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}><ScreenStatusBar /><Text style={{ color: c.text, padding: 24 }}>{t('unavailable')}</Text></SafeAreaView>;
  return <View style={{ flex: 1, backgroundColor: c.background }}>
    {Platform.OS === 'ios' ? <Stack.Screen options={{ statusBarHidden }} /> : null}
  </View>;
}
