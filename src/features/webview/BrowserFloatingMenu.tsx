import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';

type Props = {
  expanded: boolean; canGoBack: boolean; canGoForward: boolean;
  onToggle: () => void; onBack: () => void; onHome: () => void; onReload: () => void;
  onForward: () => void; onAccount: () => void; onLink: () => void; onSettings: () => void;
  fullScreen: boolean; onToggleFullScreen: () => void;
};

export function BrowserFloatingMenu(props: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboardVisible) return null;
  const actions: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }[] = [
    { icon: 'chevron-back', label: t(props.canGoBack ? 'back' : 'browser.leave'), onPress: props.onBack },
    { icon: 'home-outline', label: t('browser.appHome'), onPress: props.onHome },
    { icon: 'refresh', label: t('browser.reload'), onPress: props.onReload },
    { icon: 'chevron-forward', label: t('browser.forward'), onPress: props.onForward, disabled: !props.canGoForward },
    { icon: 'people-circle-outline', label: t('browser.accounts'), onPress: props.onAccount },
    { icon: 'link-outline', label: t('browser.openLink'), onPress: props.onLink },
    { icon: 'settings-outline', label: t('settings'), onPress: props.onSettings },
  ];
  return <View pointerEvents="box-none" style={[styles.container, { bottom: insets.bottom + 78, left: insets.left + 16, right: insets.right + 16 }]}>
    {props.expanded ? <Pressable accessibilityRole="button" accessibilityLabel={t(props.fullScreen ? 'browser.showControls' : 'browser.fullScreen')}
      onPress={props.onToggleFullScreen} style={({ pressed }) => [styles.screenMode, pressed && { opacity: 0.7 }]}>
      <Ionicons name={props.fullScreen ? 'contract-outline' : 'expand-outline'} size={20} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{t(props.fullScreen ? 'browser.showControls' : 'browser.fullScreen')}</Text>
    </Pressable> : null}
    {props.expanded ? <View style={styles.toolbar}>
      {actions.map((action) => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label}
        accessibilityState={{ disabled: Boolean(action.disabled) }} disabled={action.disabled} onPress={action.onPress}
        style={({ pressed }) => [styles.action, { opacity: action.disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
        <Ionicons name={action.icon} size={25} color="#FFFFFF" />
      </Pressable>)}
    </View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={t(props.expanded ? 'browser.closeMenu' : 'browser.menu')}
      accessibilityState={{ expanded: props.expanded }} onPress={props.onToggle}
      style={({ pressed }) => [styles.fab, pressed && { backgroundColor: '#4F4F52' }]}>
      <Ionicons name={props.expanded ? 'close' : 'menu'} size={29} color="#FFFFFF" />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  screenMode: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, borderRadius: 24, backgroundColor: '#41494DF5', borderColor: '#FFFFFF40', borderWidth: 1 },
  container: { position: 'absolute', alignItems: 'flex-end', gap: 18 },
  toolbar: { width: '100%', maxWidth: 500, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: 5,
    minHeight: 60, borderRadius: 36, backgroundColor: '#41494DF5', borderColor: '#FFFFFF40', borderWidth: 1,
    shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  action: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  fab: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#2C2D30E8', borderWidth: 1, borderColor: '#FFFFFF50', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});
