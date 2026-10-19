import { Text } from '../../components/Typography';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../theme';

export function WebViewErrorState({ onRetry, onSettings, title, description }: { onRetry: () => void; onSettings?: () => void; title: string; description: string }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  return (
    <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: c.background, gap: 13 }}>
      <Ionicons name="cloud-offline-outline" size={36} color={c.muted} />
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 18 }}>{title}</Text>
      <Text style={{ color: c.muted, textAlign: 'center', fontSize: 14, lineHeight: 21 }}>{description}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('retry')} onPress={onRetry} style={{ marginTop: 5, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: c.primary }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('retry')}</Text>
      </Pressable>
      {onSettings ? <Pressable accessibilityRole="button" accessibilityLabel={t('settings')} onPress={onSettings} style={{ paddingHorizontal: 12, paddingVertical: 12 }}><Text style={{ color: c.primary, fontWeight: '600' }}>{t('settings')}</Text></Pressable> : null}
    </View>
  );
}
