import { Text } from './Typography';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from './AppIcon';
import { appCatalog } from '../features/apps/catalog';
import { ALL_PLATFORMS } from '../services/protection/engine';
import type { SocialAppId } from '../types/app';
import { useAppTheme } from '../theme';

export function PlatformPicker({ value, onChange }: { value: SocialAppId[]; onChange: (apps: SocialAppId[]) => void }) {
  const c = useAppTheme();
  return <View style={{ gap: 5 }}>{ALL_PLATFORMS.map((id) => <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked: value.includes(id) }} accessibilityLabel={appCatalog[id].name} onPress={() => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id])} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}><AppIcon appId={id} size={32} /><Text style={{ flex: 1, color: c.text, fontWeight: '600' }}>{appCatalog[id].name}</Text><Ionicons name={value.includes(id) ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={value.includes(id) ? c.primary : c.faint} /></Pressable>)}</View>;
}
