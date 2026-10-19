import { Text } from '../../components/Typography';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../theme';

export function RestorePurchasesButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={t('subscription.restore')} disabled={disabled} onPress={onPress} hitSlop={10} style={{ paddingVertical: 8, opacity: disabled ? 0.5 : 1 }}>
    <Text style={{ color: c.primary, textAlign: 'center', fontSize: 14, fontWeight: '600' }}>{t('subscription.restore')}</Text>
  </Pressable>;
}
