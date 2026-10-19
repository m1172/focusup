import { View } from 'react-native';
import { useAppTheme } from '../theme';

/** Onboarding progress: active step is a 24×6 pill, others 6×6 dots. */
export function StepDots({ step, count = 3 }: { step: number; count?: number }) {
  const c = useAppTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
    {Array.from({ length: count }, (_, i) => <View key={i} style={{ width: i === step ? 24 : 6, height: 6, borderRadius: 3, backgroundColor: i === step ? c.accent : c.off }} />)}
  </View>;
}
