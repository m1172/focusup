import { useEffect, useLayoutEffect, useState } from 'react';
import { Animated, Keyboard, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { useBrowserMenuStore, type MenuButtonSpot } from '../../store/browserMenuStore';
import { clampMenuButtonPoint, MENU_BUTTON_SIZE, menuButtonPoint, menuButtonSpotFor, type Area, type Insets } from './menuButtonSpot';

/** Finger travel before a touch on the button counts as a drag instead of a tap. */
const DRAG_START = 8;

type Props = {
  expanded: boolean; canGoBack: boolean; canGoForward: boolean;
  onToggle: () => void; onBack: () => void; onHome: () => void; onReload: () => void;
  onForward: () => void; onAccount: () => void; onLink: () => void; onSettings: () => void;
  fullScreen: boolean; onToggleFullScreen: () => void;
};

type Latest = { area: Area | null; base: { left: number; top: number } | null; insets: Insets; props: Props };

/**
 * Dragging the button: it follows the finger inside the safe area and is saved where it is let go.
 * One per menu; `update` gives it the latest layout after each render.
 */
class MenuDrag {
  private latest: Latest | null = null;
  readonly offset = new Animated.ValueXY();
  readonly responder;
  constructor(setSpot: (spot: MenuButtonSpot) => void) {
    const moved = (dx: number, dy: number) => Math.abs(dx) + Math.abs(dy) > DRAG_START;
    const pointFor = (dx: number, dy: number) => {
      const now = this.latest;
      return now?.area && now.base ? clampMenuButtonPoint({ left: now.base.left + dx, top: now.base.top + dy }, now.area, now.insets) : null;
    };
    const drop = (dx: number, dy: number) => {
      const now = this.latest;
      const point = pointFor(dx, dy);
      if (now?.area && point) { setSpot(menuButtonSpotFor(point, now.area, now.insets)); void Haptics.selectionAsync(); }
    };
    this.responder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => moved(gesture.dx, gesture.dy),
      onMoveShouldSetPanResponder: (_, gesture) => moved(gesture.dx, gesture.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { if (this.latest?.props.expanded) this.latest.props.onToggle(); },
      onPanResponderMove: (_, gesture) => {
        const start = this.latest?.base;
        const point = pointFor(gesture.dx, gesture.dy);
        if (start && point) this.offset.setValue({ x: point.left - start.left, y: point.top - start.top });
      },
      onPanResponderRelease: (_, gesture) => drop(gesture.dx, gesture.dy),
      onPanResponderTerminate: (_, gesture) => drop(gesture.dx, gesture.dy),
    });
  }
  update(latest: Latest) { this.latest = latest; }
  /** Called once the button is drawn at its new saved spot, so it never jumps back. */
  settle() { this.offset.setValue({ x: 0, y: 0 }); }
}

export function BrowserFloatingMenu(props: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [area, setArea] = useState<Area | null>(null);
  const spot = useBrowserMenuStore((state) => state.spot);
  const setSpot = useBrowserMenuStore((state) => state.setSpot);
  const base = area ? menuButtonPoint(spot, area, insets) : null;
  // While dragging, the button follows the finger as an offset from its saved spot.
  const [drag] = useState(() => new MenuDrag(setSpot));
  useLayoutEffect(() => { drag.update({ area, base, insets, props }); });
  useLayoutEffect(() => { drag.settle(); }, [drag, base?.left, base?.top]);
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
  // The toolbar opens on the side of the screen with more room: below a button in the top half, above it otherwise.
  const below = Boolean(area && base && base.top + MENU_BUTTON_SIZE / 2 < area.height / 2);
  const onRight = Boolean(area && base && base.left + MENU_BUTTON_SIZE / 2 >= area.width / 2);
  const screenMode = props.expanded ? <Pressable accessibilityRole="button" accessibilityLabel={t(props.fullScreen ? 'browser.showControls' : 'browser.fullScreen')}
    onPress={props.onToggleFullScreen} style={({ pressed }) => [styles.screenMode, pressed && { opacity: 0.7 }]}>
    <Ionicons name={props.fullScreen ? 'contract-outline' : 'expand-outline'} size={20} color="#FFFFFF" />
    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{t(props.fullScreen ? 'browser.showControls' : 'browser.fullScreen')}</Text>
  </Pressable> : null;
  const toolbar = props.expanded ? <View style={styles.toolbar}>
    {actions.map((action) => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label}
      accessibilityState={{ disabled: Boolean(action.disabled) }} disabled={action.disabled} onPress={action.onPress}
      style={({ pressed }) => [styles.action, { opacity: action.disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <Ionicons name={action.icon} size={25} color="#FFFFFF" />
    </Pressable>)}
  </View> : null;

  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}
    onLayout={(event) => { const { width, height } = event.nativeEvent.layout; setArea((old) => old?.width === width && old.height === height ? old : { width, height }); }}>
    {area && base && props.expanded ? <View pointerEvents="box-none" style={[styles.panel, { left: insets.left + 16, right: insets.right + 16, alignItems: onRight ? 'flex-end' : 'flex-start' },
      below ? { top: base.top + MENU_BUTTON_SIZE + 14 } : { bottom: area.height - base.top + 14 }]}>
      {below ? <>{toolbar}{screenMode}</> : <>{screenMode}{toolbar}</>}
    </View> : null}
    {base ? <Animated.View {...drag.responder.panHandlers} style={[styles.fabSpot, { left: base.left, top: base.top, transform: drag.offset.getTranslateTransform() }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(props.expanded ? 'browser.closeMenu' : 'browser.menu')} accessibilityHint={t('browser.menuMoveHint')}
        accessibilityState={{ expanded: props.expanded }} onPress={props.onToggle}
        style={({ pressed }) => [styles.fab, pressed && { backgroundColor: '#4F4F52' }]}>
        <Ionicons name={props.expanded ? 'close' : 'menu'} size={29} color="#FFFFFF" />
      </Pressable>
    </Animated.View> : null}
  </View>;
}

const styles = StyleSheet.create({
  screenMode: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, borderRadius: 24, backgroundColor: '#41494DF5', borderColor: '#FFFFFF40', borderWidth: 1 },
  panel: { position: 'absolute', gap: 14 },
  fabSpot: { position: 'absolute', width: MENU_BUTTON_SIZE, height: MENU_BUTTON_SIZE },
  toolbar: { width: '100%', maxWidth: 500, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: 5,
    minHeight: 60, borderRadius: 36, backgroundColor: '#41494DF5', borderColor: '#FFFFFF40', borderWidth: 1,
    shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  action: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  fab: { width: MENU_BUTTON_SIZE, height: MENU_BUTTON_SIZE, borderRadius: MENU_BUTTON_SIZE / 2, backgroundColor: '#2C2D30E8', borderWidth: 1, borderColor: '#FFFFFF50', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});
