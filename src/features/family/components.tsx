import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from '../../components/Typography';
import { useAppTheme } from '../../theme';

/** Labelled text field for the family screens; light and dark through the theme. */
export function FamilyField({ label, style, ...props }: TextInputProps & { label: string }) {
  const c = useAppTheme();
  return <View style={{ gap: 6, flex: style ? undefined : 1 }}>
    <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={c.text3} {...props}
      style={[{ minHeight: 52, borderRadius: 16, paddingHorizontal: 16, backgroundColor: c.card2, color: c.text, fontSize: 17, fontWeight: '600' }, style]} />
  </View>;
}

/** A large code, e.g. the pairing code on the parent's phone or the confirmation code on the child's. */
export function BigCode({ code, label }: { code: string; label: string }) {
  const c = useAppTheme();
  return <View accessible accessibilityLabel={`${label}: ${code.split('').join(' ')}`} style={{ alignItems: 'center', gap: 8, paddingVertical: 20, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
    <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    <Text selectable adjustsFontSizeToFit numberOfLines={1} style={{ color: c.text, fontSize: 40, lineHeight: 48, fontWeight: '800', letterSpacing: 4, paddingHorizontal: 12 }}>{code}</Text>
  </View>;
}
