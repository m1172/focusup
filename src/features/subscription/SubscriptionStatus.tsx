import { Text } from '../../components/Typography';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../theme';

export function SubscriptionStatus({ isPro }: { isPro: boolean }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
    <Ionicons name={isPro ? 'sparkles' : 'lock-closed-outline'} size={17} color={isPro ? c.success : c.muted} />
    <Text style={{ color: c.muted, fontSize: 13 }}>{t(isPro ? 'subscription.active' : 'subscription.freePlan')}</Text>
  </View>;
}
