import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, LayoutAnimation, PanResponder, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { AppIcon } from '../../components/AppIcon';
import { FocusLogo } from '../../components/FocusLogo';
import { useAppTheme } from '../../theme';
import { appCatalog } from '../apps/catalog';
import type { SocialAppId } from '../../types/app';

type Rect = { x: number; y: number; width: number; height: number };
type Target = 'orbit' | 'tray' | null;
type Drag = { id: SocialAppId; from: 'orbit' | 'tray' };
/** Where an icon starts when it appears: an offset from its resting place, a start size and a stagger delay. */
type Entrance = { x: number; y: number; scale: number; delay: number };
/** What happens to an icon after it is let go: spring back, or be pulled into the Vaqtim logo. */
type Drop = 'return' | 'absorb';

/** Where each app sits on the ring: top left, top right, bottom. Fixed so icons never jump around. */
const SLOT_ANGLE: Partial<Record<SocialAppId, number>> = { instagram: -150, youtube: -30, tiktok: 90 };
/** Each icon drifts at its own pace so the three never move in step. */
const DRIFT: Partial<Record<SocialAppId, { delay: number; y: number; x: number }>> = {
  instagram: { delay: 0, y: 2400, x: 3100 },
  youtube: { delay: 650, y: 2800, x: 3600 },
  tiktok: { delay: 1300, y: 2600, x: 3300 },
};
const BUBBLE = 66;
const TRAY_BUBBLE = 54;
const TRAY_GAP = 12;
const TRAY_PAD_X = 14;
const TRAY_PAD_BOTTOM = 12;

const AnimatedLine = Animated.createAnimatedComponent(Line);
const inside = (rect: Rect | null, x: number, y: number) => Boolean(rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height);
const sway = (value: Animated.Value, ms: number) => Animated.loop(Animated.sequence([
  Animated.timing(value, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
  Animated.timing(value, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
]));

type Props = {
  apps: readonly SocialAppId[];
  /** Apps that are on in Vaqtim; the rest wait in the tray. */
  connected: readonly SocialAppId[];
  /** Apps whose original app is blocked too: they get a lock badge. */
  nativeBlocked: readonly SocialAppId[];
  height: number;
  onOpen: (appId: SocialAppId) => void;
  onConnect: (appId: SocialAppId) => void;
  onDisconnect: (appId: SocialAppId) => void;
  /** The parent turns its own scrolling off while an icon is being dragged. */
  onDragChange?: (dragging: boolean) => void;
};

/**
 * Vaqtim in the middle, the apps it protects around it. Drag an app down into the tray to turn it off,
 * or from the tray back to the middle to turn it on. Taps and screen-reader actions do the same without dragging.
 * Icons float gently, fly between the ring and the tray, and the logo answers with a ripple when something connects.
 */
export function AppOrbit({ apps, connected, nativeBlocked, height, onOpen, onConnect, onDisconnect, onDragChange }: Props) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Target>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Where an app that is about to land in the tray starts, so it flies there from the ring instead of appearing.
  const [launch, setLaunch] = useState<{ appId: SocialAppId; x: number; y: number } | null>(null);
  const orbitRef = useRef<ComponentRef<typeof View>>(null);
  const trayRef = useRef<ComponentRef<typeof View>>(null);
  const rects = useRef<{ orbit: Rect | null; tray: Rect | null }>({ orbit: null, tray: null });
  const previousCount = useRef(connected.length);

  // One drag offset per app, shared by its icon and its line so the line stays attached while the icon moves.
  const [pans] = useState(() => new Map(apps.map((id) => [id, new Animated.ValueXY()])));
  const [centerHot] = useState(() => new Animated.Value(0));
  const [trayHot] = useState(() => new Animated.Value(0));
  const [breathe] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [kick] = useState(() => new Animated.Value(1));
  const [ripple] = useState(() => [new Animated.Value(0), new Animated.Value(0)] as const);

  // Idle motion: the logo breathes and the dashed ring turns very slowly.
  useEffect(() => {
    if (reducedMotion) return undefined;
    const breathing = sway(breathe, 2600);
    const turning = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 140_000, easing: Easing.linear, useNativeDriver: true }));
    breathing.start(); turning.start();
    return () => { breathing.stop(); turning.stop(); };
  }, [breathe, spin, reducedMotion]);

  useEffect(() => {
    const anims = [
      Animated.spring(centerHot, { toValue: hover === 'orbit' ? 1 : 0, friction: 6, tension: 120, useNativeDriver: true }),
      Animated.timing(trayHot, { toValue: hover === 'tray' ? 1 : 0, duration: 180, useNativeDriver: false }),
    ];
    anims.forEach((anim) => anim.start());
  }, [hover, centerHot, trayHot]);

  // The logo answers when an app joins (ripples, a bump) or leaves (a small sigh).
  useEffect(() => {
    const before = previousCount.current;
    previousCount.current = connected.length;
    if (connected.length === before) return;
    // The tray grows or shrinks with its contents; let what sits below slide instead of jumping.
    if (!reducedMotion) LayoutAnimation.configureNext({ duration: 320, update: { type: LayoutAnimation.Types.easeInEaseOut } });
    if (reducedMotion) return;
    if (connected.length > before) {
      ripple.forEach((value) => value.setValue(0));
      Animated.parallel(ripple.map((value, index) => Animated.sequence([
        Animated.delay(index * 220),
        Animated.timing(value, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]))).start();
      Animated.sequence([
        Animated.timing(kick, { toValue: 1.16, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(kick, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.timing(kick, { toValue: 0.9, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(kick, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      ]).start();
    }
  }, [connected.length, kick, ripple, reducedMotion]);

  const measure = () => {
    orbitRef.current?.measureInWindow((x, y, w, h) => { rects.current.orbit = { x, y, width: w, height: h }; });
    trayRef.current?.measureInWindow((x, y, w, h) => { rects.current.tray = { x, y, width: w, height: h }; });
  };
  const targetAt = (x: number, y: number): Target => inside(rects.current.tray, x, y) ? 'tray' : inside(rects.current.orbit, x, y) ? 'orbit' : null;

  const cx = width / 2, cy = height / 2;
  const radius = Math.max(70, Math.min(width, height) / 2 - BUBBLE / 2 - 8);
  const slot = (appId: SocialAppId) => {
    const angle = ((SLOT_ANGLE[appId] ?? 0) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  };
  const inTray = apps.filter((id) => !connected.includes(id));

  // Turning an app off can wait for a typed sentence, so remember where it left from: it flies from its place on the ring into the tray once it is really off.
  const requestDisconnect = (appId: SocialAppId) => {
    measure();
    const { orbit, tray } = rects.current;
    if (orbit && tray) {
      const from = slot(appId);
      const index = apps.filter((id) => id === appId || !connected.includes(id)).indexOf(appId);
      const toX = tray.x + TRAY_PAD_X + index * (TRAY_BUBBLE + TRAY_GAP) + TRAY_BUBBLE / 2;
      const toY = tray.y + tray.height - TRAY_PAD_BOTTOM - TRAY_BUBBLE / 2;
      setLaunch({ appId, x: orbit.x + from.x - toX, y: orbit.y + from.y - toY });
    }
    onDisconnect(appId);
  };

  const dragHandlers = (appId: SocialAppId, from: 'orbit' | 'tray') => ({
    onStart: () => { measure(); setDrag({ id: appId, from }); onDragChange?.(true); void Haptics.selectionAsync(); },
    onMove: (x: number, y: number) => {
      const target = targetAt(x, y);
      const next = from === 'orbit' ? (target === 'tray' ? 'tray' : null) : (target === 'orbit' ? 'orbit' : null);
      setHover((current) => {
        if (current !== next && next) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return next;
      });
    },
    onEnd: (x: number, y: number): Drop => {
      const target = targetAt(x, y);
      setHover(null); setDrag(null); onDragChange?.(false);
      if (from === 'orbit' && target === 'tray') { requestDisconnect(appId); return 'return'; }
      if (from === 'tray' && target === 'orbit') { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onConnect(appId); return 'absorb'; }
      return 'return';
    },
    onCancel: () => { setHover(null); setDrag(null); onDragChange?.(false); },
  });

  const logoScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const hotScale = centerHot.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const haloScale = centerHot.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const spinDegrees = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringLine = c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(67,56,202,0.10)';
  const trayBase = c.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(14,16,32,0.12)';
  const trayFill = c.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)';

  return <View style={{ gap: 14 }}>
    <View ref={orbitRef} onLayout={(event: LayoutChangeEvent) => { setWidth(event.nativeEvent.layout.width); measure(); }} style={{ height, zIndex: drag?.from === 'orbit' ? 5 : 0 }}>
      {width > 0 ? <>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width, height, transform: [{ rotate: spinDegrees }] }}>
          <Svg width={width} height={height}>
            <Circle cx={cx} cy={cy} r={radius} stroke={ringLine} strokeWidth={1.5} strokeDasharray="4 7" fill="none" />
          </Svg>
        </Animated.View>
        <Svg width={width} height={height} style={{ position: 'absolute' }} pointerEvents="none">
          <Circle cx={cx} cy={cy} r={radius * 0.56} stroke={c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(67,56,202,0.07)'} strokeWidth={1.5} fill="none" />
          {apps.map((id) => {
            const p = slot(id);
            const pan = pans.get(id);
            // Held over the tray, the line turns red: let go and it snaps.
            const tense = drag?.id === id && hover === 'tray';
            return pan ? <OrbitLine key={id} x1={cx} y1={cy} x2={p.x} y2={p.y} pan={pan} active={connected.includes(id)} solid={nativeBlocked.includes(id) || tense} color={tense ? c.red : c.accent} /> : null;
          })}
        </Svg>
        {/* Halo and logo swell while an app from the tray is held over the middle. */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cx - 110, top: cy - 110, width: 220, height: 220, opacity: haloOpacity, transform: [{ scale: haloScale }] }}>
          <View style={{ flex: 1, borderRadius: 110, backgroundImage: c.lockHalo }} />
        </Animated.View>
        {ripple.map((value, index) => <Animated.View key={index} pointerEvents="none" style={{
          position: 'absolute', left: cx - 44, top: cy - 44, width: 88, height: 88, borderRadius: 30, borderWidth: 1, borderColor: c.accent,
          opacity: value.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
          transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.9, 3.4] }) }],
        }} />)}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cx - 44, top: cy - 44, width: 88, height: 88, alignItems: 'center', justifyContent: 'center', transform: [{ scale: hotScale }] }}>
          <Animated.View style={{ position: 'absolute', width: 88, height: 88, borderRadius: 30, borderWidth: 3, borderColor: c.accent, opacity: centerHot }} />
          <Animated.View style={{ transform: [{ scale: kick }] }}>
            <Animated.View style={{ transform: [{ scale: logoScale }] }}>
              <FocusLogo size={76} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
        {apps.map((id, index) => {
          const p = slot(id);
          if (!connected.includes(id)) {
            // An empty place on the ring shows where the app goes back; tapping it turns the app on.
            return <EmptySlot key={id} appId={id} left={p.x - BUBBLE / 2} top={p.y - BUBBLE / 2} hot={hover === 'orbit' && drag?.id === id}
              label={`${appCatalog[id].name}. ${t('ui.orbitTurnOn')}`} onPress={() => onConnect(id)} />;
          }
          return <DraggableApp key={id} appId={id} size={BUBBLE} left={p.x - BUBBLE / 2} top={p.y - BUBBLE / 2} float pan={pans.get(id)}
            enter={{ x: cx - p.x, y: cy - p.y, scale: 0.3, delay: index * 90 }}
            badge={nativeBlocked.includes(id) ? 'lock' : 'unlock'}
            label={`${appCatalog[id].name}. ${t(nativeBlocked.includes(id) ? 'ui.realAppBlocked' : 'ui.cleanInVaqtim')}`}
            actionLabel={t('ui.orbitTurnOff')}
            onTap={() => onOpen(id)} onAction={() => requestDisconnect(id)} {...dragHandlers(id, 'orbit')} />;
        })}
      </> : null}
    </View>

    <Animated.View ref={trayRef} onLayout={measure} style={{
      minHeight: inTray.length ? 96 : 64, justifyContent: 'center', borderRadius: 26, borderWidth: 1.5, borderStyle: 'dashed', zIndex: drag?.from === 'tray' ? 5 : 0,
      borderColor: trayHot.interpolate({ inputRange: [0, 1], outputRange: [trayBase, c.red] }),
      backgroundColor: trayHot.interpolate({ inputRange: [0, 1], outputRange: [trayFill, c.redSoft] }),
      paddingHorizontal: TRAY_PAD_X, paddingTop: 10, paddingBottom: TRAY_PAD_BOTTOM, gap: 8,
    }}>
      <Text style={{ color: hover === 'tray' ? c.red : c.text3, fontSize: 12, lineHeight: 16, fontWeight: '600', textAlign: 'center' }}>
        {t(inTray.length && hover !== 'tray' ? 'ui.orbitConnectHint' : 'ui.orbitDropHint')}
      </Text>
      {inTray.length ? <View style={{ flexDirection: 'row', gap: TRAY_GAP, minHeight: TRAY_BUBBLE }}>
        {inTray.map((id, index) => <DraggableApp key={id} appId={id} size={TRAY_BUBBLE}
          enter={launch?.appId === id ? { x: launch.x, y: launch.y, scale: BUBBLE / TRAY_BUBBLE, delay: 0 } : { x: 0, y: -70, scale: 0.6, delay: 200 + index * 90 }}
          label={`${appCatalog[id].name}. ${t('ui.notProtected')}`} actionLabel={t('ui.orbitTurnOn')}
          onTap={() => onConnect(id)} onAction={() => onConnect(id)} {...dragHandlers(id, 'tray')} />)}
      </View> : null}
    </Animated.View>
  </View>;
}

type OrbitLineProps = { x1: number; y1: number; x2: number; y2: number; pan: Animated.ValueXY; active: boolean; solid: boolean; color: string };

/**
 * The spoke between Vaqtim and an app. Its end rides on the icon's own offset, so it follows the icon as it flies in,
 * floats and is dragged, stretching rather than breaking. It only pulls back once the app is really turned off.
 */
function OrbitLine({ x1, y1, x2, y2, pan, active, solid, color }: OrbitLineProps) {
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    const anim = Animated.timing(progress, { toValue: active ? 1 : 0, duration: active ? 420 : 320, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [active, progress]);
  const x = Animated.add(x1, Animated.multiply(Animated.add(x2 - x1, pan.x), progress)) as unknown as number;
  const y = Animated.add(y1, Animated.multiply(Animated.add(y2 - y1, pan.y), progress)) as unknown as number;
  return <AnimatedLine x1={x1} y1={y1} x2={x} y2={y} stroke={color} strokeOpacity={solid ? 0.45 : 0.25} strokeWidth={2} strokeDasharray={solid ? undefined : '3 6'} strokeLinecap="round" />;
}

type EmptySlotProps = { appId: SocialAppId; left: number; top: number; hot: boolean; label: string; onPress: () => void };

/** A faint ghost of the app where it belongs on the ring. It breathes to invite, and swells when its app is held over the middle. */
function EmptySlot({ appId, left, top, hot, label, onPress }: EmptySlotProps) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [appear] = useState(() => new Animated.Value(0));
  const [heat] = useState(() => new Animated.Value(0));
  const [breathe] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(appear, { toValue: 1, duration: 420, delay: 180, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [appear]);
  useEffect(() => {
    const anim = Animated.spring(heat, { toValue: hot ? 1 : 0, friction: 6, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [hot, heat]);
  useEffect(() => {
    if (reducedMotion) return undefined;
    const loop = sway(breathe, 1500);
    loop.start();
    return () => loop.stop();
  }, [breathe, reducedMotion]);
  return <Animated.View style={{ position: 'absolute', left, top, opacity: appear, transform: [{ scale: heat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
      <Animated.View style={{ width: BUBBLE, height: BUBBLE, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: hot ? c.accent : c.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(67,56,202,0.22)', backgroundColor: hot ? c.soft : 'transparent', alignItems: 'center', justifyContent: 'center', transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }}>
        <View style={{ opacity: hot ? 0.55 : 0.22 }}><AppIcon appId={appId} size={Math.round(BUBBLE * 0.6)} /></View>
        <View style={{ position: 'absolute', right: -5, bottom: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={12} color="#FFFFFF" strokeWidth={2.8} />
        </View>
      </Animated.View>
    </Pressable>
  </Animated.View>;
}

type DraggableProps = {
  appId: SocialAppId;
  size: number;
  left?: number;
  top?: number;
  float?: boolean;
  enter: Entrance;
  /** The orbit's offset for this app, so its line can follow; tray icons keep their own. */
  pan?: Animated.ValueXY;
  /** Locked: the real app is blocked too. Unlocked: clean in Vaqtim only. */
  badge?: 'lock' | 'unlock';
  label: string;
  actionLabel: string;
  onTap: () => void;
  onAction: () => void;
  onStart: () => void;
  onMove: (x: number, y: number) => void;
  onEnd: (x: number, y: number) => Drop;
  onCancel: () => void;
};

function DraggableApp({ appId, size, left, top, float = false, enter, pan: sharedPan, badge, label, actionLabel, onTap, onAction, onStart, onMove, onEnd, onCancel }: DraggableProps) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  // Every value is made once; the entrance starts offset from the resting place and springs home.
  const [ownPan] = useState(() => new Animated.ValueXY(reducedMotion ? { x: 0, y: 0 } : { x: enter.x, y: enter.y }));
  const pan = sharedPan ?? ownPan;
  const [lift] = useState(() => new Animated.Value(1));
  const [fade] = useState(() => new Animated.Value(1));
  const [arrive] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const [driftY] = useState(() => new Animated.Value(0));
  const [driftX] = useState(() => new Animated.Value(0));
  const [badgePop] = useState(() => new Animated.Value(1));
  // The latest handlers, so the responder made once still calls the current ones.
  const handlers = useRef({ onTap, onStart, onMove, onEnd, onCancel });
  useEffect(() => { handlers.current = { onTap, onStart, onMove, onEnd, onCancel }; });

  useEffect(() => {
    if (reducedMotion) { pan.setValue({ x: 0, y: 0 }); return undefined; }
    pan.setValue({ x: enter.x, y: enter.y });
    const anim = Animated.parallel([
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 55, delay: enter.delay, useNativeDriver: false }),
      Animated.spring(arrive, { toValue: 1, friction: 6, tension: 70, delay: enter.delay, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
    // Only the first appearance flies in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!badge || reducedMotion) return undefined;
    badgePop.setValue(0);
    const anim = Animated.spring(badgePop, { toValue: 1, friction: 3.5, tension: 120, delay: float ? 420 : 0, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [badge, badgePop, float, reducedMotion]);

  useEffect(() => {
    if (!float || reducedMotion) return undefined;
    const pace = DRIFT[appId] ?? { delay: 0, y: 2600, x: 3300 };
    const loops = [sway(driftY, pace.y), sway(driftX, pace.x)];
    const start = Animated.delay(pace.delay);
    start.start(() => loops.forEach((loop) => loop.start()));
    return () => { start.stop(); loops.forEach((loop) => loop.stop()); };
  }, [appId, driftX, driftY, float, reducedMotion]);

  // The responder's callbacks read `handlers` only during touches, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    let moved = false;
    const settle = () => Animated.parallel([
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }),
      Animated.spring(lift, { toValue: 1, useNativeDriver: false }),
    ]).start();
    // Pulled into the logo, then back to its place in case it did not connect (permission refused).
    const absorb = () => Animated.sequence([
      Animated.parallel([
        Animated.timing(lift, { toValue: 0.2, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        Animated.timing(fade, { toValue: 0, duration: 170, useNativeDriver: false }),
      ]),
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(pan, { toValue: { x: 0, y: 0 }, duration: 1, useNativeDriver: false }),
        Animated.spring(lift, { toValue: 1, friction: 6, useNativeDriver: false }),
        Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: false }),
      ]),
    ]).start();
    return PanResponder.create({
      // Claim the touch at once so the screen does not scroll under the finger; a short touch is a tap.
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        moved = false;
        Animated.spring(lift, { toValue: 0.94, speed: 40, useNativeDriver: false }).start();
      },
      onPanResponderMove: (_, g) => {
        if (!moved && Math.hypot(g.dx, g.dy) > 6) {
          moved = true;
          handlers.current.onStart();
          Animated.spring(lift, { toValue: 1.16, friction: 5, useNativeDriver: false }).start();
        }
        if (!moved) return;
        pan.setValue({ x: g.dx, y: g.dy });
        handlers.current.onMove(g.moveX, g.moveY);
      },
      onPanResponderRelease: (_, g) => {
        if (!moved) {
          Animated.spring(lift, { toValue: 1, friction: 4, useNativeDriver: false }).start();
          handlers.current.onTap();
          return;
        }
        if (handlers.current.onEnd(g.moveX, g.moveY) === 'absorb') absorb(); else settle();
      },
      onPanResponderTerminate: () => {
        if (moved) handlers.current.onCancel();
        settle();
      },
    });
  });

  const translateY = driftY.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const translateX = driftX.interpolate({ inputRange: [0, 1], outputRange: [-3, 3] });
  const tilt = driftX.interpolate({ inputRange: [0, 1], outputRange: ['-2.2deg', '2.2deg'] });
  const dragTilt = pan.x.interpolate({ inputRange: [-160, 0, 160], outputRange: ['-9deg', '0deg', '9deg'], extrapolate: 'clamp' });
  const arriveScale = arrive.interpolate({ inputRange: [0, 1], outputRange: [enter.scale, 1] });
  const arriveOpacity = arrive.interpolate({ inputRange: [0, 0.35], outputRange: [0, 1], extrapolate: 'clamp' });
  const radius = Math.round(size * 0.34);
  return <Animated.View
    {...responder.panHandlers}
    accessible
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityActions={[{ name: 'activate' }, { name: 'toggle', label: actionLabel }]}
    onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'toggle') onAction(); else onTap(); }}
    style={[
      left !== undefined ? { position: 'absolute', left, top } : null,
      { zIndex: 10, opacity: fade, transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: dragTilt }, { scale: lift }] },
    ]}>
    <Animated.View style={{ opacity: arriveOpacity, transform: [{ scale: arriveScale }, ...(float ? [{ translateX }, { translateY }, { rotate: tilt }] : [])] }}>
      <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: c.card, boxShadow: c.isDark ? '0px 10px 24px rgba(0,0,0,0.45)' : '0px 2px 4px rgba(24,28,70,0.05), 0px 12px 26px rgba(24,28,70,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <AppIcon appId={appId} size={Math.round(size * 0.76)} />
      </View>
      {badge ? <Animated.View style={{ position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, borderColor: c.card, backgroundColor: badge === 'lock' ? c.accent : c.off, alignItems: 'center', justifyContent: 'center', transform: [{ scale: badgePop }] }}>
        <Icon name={badge === 'lock' ? 'lock' : 'lockOpen'} size={12} color={badge === 'lock' ? '#FFFFFF' : c.text2} strokeWidth={2.6} />
      </Animated.View> : null}
    </Animated.View>
  </Animated.View>;
}
