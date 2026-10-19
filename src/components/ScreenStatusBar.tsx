import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useAppTheme } from '../theme';

export function ScreenStatusBar() {
  const c = useAppTheme();
  // iOS status bars are owned by the Router stack, including full-screen browser routes.
  return Platform.OS === 'ios' ? null : <StatusBar style={c.isDark ? 'light' : 'dark'} animated />;
}
