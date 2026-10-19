import { Text } from '../../components/Typography';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme';

export function WebViewLoadingState({ progress = 0, label }: { progress?: number; label: string }) {
  const c = useAppTheme();
  return (
    <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background, gap: 14 }}>
      <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="sparkles" size={26} color={c.primary} />
      </View>
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{label}</Text>
      <ActivityIndicator color={c.primary} />
      <View style={{ width: 140, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: c.border }}>
        <View style={{ width: `${Math.max(6, Math.round(progress * 100))}%`, height: 3, backgroundColor: c.primary }} />
      </View>
    </View>
  );
}
