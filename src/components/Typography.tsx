import { Text as NativeText, StyleSheet, type TextProps } from 'react-native';

/** Use bundled static fonts so weights render consistently on iOS and Android. */
export function Text({ style, ...props }: TextProps) {
  const resolved = StyleSheet.flatten(style);
  const weight = resolved?.fontWeight;
  const numeric = weight === 'bold' ? 700 : Number(weight ?? 400);
  const face = numeric >= 800 ? 800 : numeric >= 700 ? 700 : numeric >= 600 ? 600 : numeric >= 500 ? 500 : 400;
  return <NativeText {...props} style={[{ fontFamily: `Manrope-${face}` }, style, { fontWeight: 'normal' }]} />;
}
