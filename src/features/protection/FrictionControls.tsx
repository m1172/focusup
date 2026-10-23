import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import { formatDuration } from '../../utils/formatDuration';
import { formatInteger } from '../onboarding/dayBudget';
import { yearlyValue } from '../savings/savings';
import { HOLD_TO_ENABLE_MS, TURN_OFF_WAIT_MS, formatCountdown, phraseMatches, secondsLeft, typingProgress } from './turnOffFriction';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PILL_W = 148;
const PILL_H = 40;

/** Hold-to-charge gesture shared by the pill and the round badge: fills `progress` 0→1 over HOLD_TO_ENABLE_MS with haptic ticks; letting go early drains it. */
function useHoldCharge(onDone: () => void, disabled: boolean, onDisabledPress?: () => void, duration = HOLD_TO_ENABLE_MS) {
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [holding, setHolding] = useState(false);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => { timers.current.forEach(clearTimeout); cancelAnimation(progress); cancelAnimation(scale); }, [progress, scale]);
  const cancel = () => {
    if (!timers.current.length) return;
    clearTimers();
    setHolding(false);
    progress.set(withTiming(0, { duration: 220 }));
    scale.set(withSpring(1, { damping: 12, stiffness: 260 }));
  };
  const start = () => {
    if (disabled) { onDisabledPress?.(); return; }
    setHolding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.set(withSpring(0.94, { damping: 14, stiffness: 300 }));
    progress.set(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }));
    for (const step of [0.25, 0.5, 0.75]) timers.current.push(setTimeout(() => { void Haptics.impactAsync(step < 0.75 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium); }, duration * step));
    timers.current.push(setTimeout(() => {
      timers.current = [];
      setHolding(false);
      scale.set(withSequence(withSpring(1.1, { damping: 8, stiffness: 400 }), withSpring(1)));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      progress.set(withDelay(250, withTiming(0, { duration: 350 })));
      onDoneRef.current();
    }, duration));
  };
  return { progress, scale, holding, start, cancel };
}

/**
 * "Charge" button: holding it sweeps a gradient across with a haptic tick each quarter, and turns the
 * protection on once full (HOLD_TO_ENABLE_MS). Letting go early drains it.
 */
export function HoldToEnable({ label, onEnabled, disabled = false, onDisabledPress }: { label: string; onEnabled: () => void; disabled?: boolean; onDisabledPress?: () => void }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const { progress, scale, holding, start, cancel } = useHoldCharge(onEnabled, disabled, onDisabledPress);
  const fill = useAnimatedStyle(() => ({ width: progress.get() * PILL_W }));
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const face = (color: string) => <View style={{ width: PILL_W, height: PILL_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <Icon name="shield" size={16} color={color} strokeWidth={2.4} />
    <Text numberOfLines={1} style={{ color, fontSize: 13, fontWeight: '800' }}>{t(holding ? 'friction.holding' : 'friction.holdToTurnOn')}</Text>
  </View>;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${label}, ${t('friction.holdToTurnOn')}`}
    accessibilityState={{ disabled }}
    // Screen-reader users can't hold; turning protection on needs no friction, so activation enables directly.
    accessibilityActions={[{ name: 'activate' }]}
    onAccessibilityAction={() => { if (!disabled) onEnabled(); }}
    onPressIn={start}
    onPressOut={cancel}
    hitSlop={6}
    style={{ flexShrink: 0, opacity: disabled ? 0.5 : 1 }}
  >
    <Animated.View style={[{ width: PILL_W, height: PILL_H, borderRadius: PILL_H / 2, overflow: 'hidden', backgroundColor: c.soft, borderWidth: 1.5, borderColor: holding ? c.accent : c.soft }, pop]}>
      {face(c.ink)}
      {/* The same face in white, revealed by the growing gradient, so the label changes colour as the charge passes it. */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden', backgroundImage: c.grad }, fill]}>{face('#FFFFFF')}</Animated.View>
    </Animated.View>
  </Pressable>;
}

function Particle({ index, count, progress, color }: { index: number; count: number; progress: ReturnType<typeof useSharedValue<number>>; color: string }) {
  const angle = (index / count) * Math.PI * 2;
  const distance = index % 2 ? 30 : 42;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: 1 - p, transform: [{ translateX: Math.cos(angle) * distance * p }, { translateY: Math.sin(angle) * distance * p }, { scale: 1 - p * 0.5 }] };
  });
  return <Animated.View style={[{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />;
}

/** A short burst of coloured dots around its centre each time `trigger` changes (skips 0). */
export function CelebrationBurst({ trigger }: { trigger: number }) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(1);
  useEffect(() => {
    if (!trigger || reducedMotion) return;
    progress.set(0);
    progress.set(withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }));
  }, [progress, reducedMotion, trigger]);
  const colors = [c.accent, c.mint, c.amber, c.red, c.blue];
  return <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
    {Array.from({ length: 10 }, (_, i) => <Particle key={i} index={i} count={10} progress={progress} color={colors[i % colors.length]!} />)}
  </View>;
}

const BADGE = 172;
const BADGE_CORE = 124;
const CHARGE_STROKE = 10;
const CHARGE_R = (BADGE - CHARGE_STROKE) / 2;
const CHARGE_CIRC = 2 * Math.PI * CHARGE_R;
/** Both directions are a deliberate 3-second hold; turning off then still goes through TurnOffSheet. */
const BADGE_HOLD_MS = 3000;
const BADGE_TONES = {
  off: { core: 'linear-gradient(150deg, #FF7A7F 0%, #EF4450 55%, #C92A35 100%)', glow: '0px 16px 36px rgba(201,42,53,0.38)', ring: '#EF4450' },
  on: { core: 'linear-gradient(150deg, #4BE3AE 0%, #16B985 55%, #0A8A64 100%)', glow: '0px 16px 36px rgba(18,184,134,0.40)', ring: '#16B985' },
} as const;

/**
 * One big round switch for an app whose only filter is its short-video feed.
 * Red = Reels/Shorts visible, green = blocked. Holding it for 3 seconds fills a ring in the colour it is
 * switching to while the button itself fades into that colour; when full, red turns on (onEnable) and
 * green opens the slow turn-off flow (onTurnOff).
 */
export function ProtectionBadge({ on, feature, burst, locked = false, onEnable, onTurnOff, onLockedPress }: { on: boolean; feature: string; burst: number; locked?: boolean; onEnable: () => void; onTurnOff: () => void; onLockedPress?: () => void }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { progress, scale, holding, start, cancel } = useHoldCharge(on ? onTurnOff : onEnable, locked, onLockedPress, BADGE_HOLD_MS);
  const breath = useSharedValue(1);
  useEffect(() => {
    progress.set(withTiming(0, { duration: 300 }));
    if (reducedMotion) { cancelAnimation(breath); breath.set(1); return undefined; }
    // Green breathes calmly; red pulses a little faster to invite a press.
    const half = on ? 1400 : 900;
    breath.set(withRepeat(withSequence(withTiming(on ? 1.05 : 1.07, { duration: half, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: half, easing: Easing.inOut(Easing.quad) })), -1));
    return () => cancelAnimation(breath);
  }, [breath, on, progress, reducedMotion]);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: breath.get() }] }));
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  // The colour it is switching to grows out from the centre as the ring fills.
  const towards = useAnimatedStyle(() => ({ transform: [{ scale: progress.get() }] }));
  const charge = useAnimatedProps(() => ({ strokeDashoffset: CHARGE_CIRC * (1 - progress.get()) }));
  const tone = on ? BADGE_TONES.on : BADGE_TONES.off;
  const target = on ? BADGE_TONES.off : BADGE_TONES.on;
  const title = t(on ? 'friction.blockedTitle' : 'friction.visibleTitle', { feature });
  const hint = locked ? t('strictLockedLabel') : holding ? t('friction.holding') : t(on ? 'friction.holdToTurnOff' : 'friction.holdToTurnOnLong');
  const showTarget = holding && !locked;
  return <View style={{ alignItems: 'center', gap: 16, paddingTop: 28, paddingBottom: 24, paddingHorizontal: 20, borderRadius: 28, backgroundColor: c.card, boxShadow: c.sh }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: on ? c.mintSoft : c.redSoft }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? c.mint : c.red }} />
      <Text style={{ color: on ? c.mintInk : c.red, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 }}>{t(on ? 'friction.stateOn' : 'friction.stateOff')}</Text>
    </View>
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={hint}
      accessibilityState={{ checked: on, disabled: locked }}
      // Screen-reader users can't hold; activation turns protection on directly, or opens the turn-off flow.
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => { if (locked) onLockedPress?.(); else if (on) onTurnOff(); else onEnable(); }}
      onPressIn={start}
      onPressOut={cancel}
      style={{ width: BADGE, height: BADGE, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={[{ position: 'absolute', width: BADGE, height: BADGE, borderRadius: BADGE / 2, backgroundColor: on ? c.mintSoft : c.redSoft }, halo]} />
      <Svg width={BADGE} height={BADGE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={BADGE / 2} cy={BADGE / 2} r={CHARGE_R} stroke={c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(14,16,32,0.07)'} strokeWidth={CHARGE_STROKE} fill="none" />
        <AnimatedCircle cx={BADGE / 2} cy={BADGE / 2} r={CHARGE_R} stroke={target.ring} strokeWidth={CHARGE_STROKE} strokeLinecap="round" fill="none" strokeDasharray={`${CHARGE_CIRC} ${CHARGE_CIRC}`} animatedProps={charge} />
      </Svg>
      <Animated.View style={[{ width: BADGE_CORE, height: BADGE_CORE, borderRadius: BADGE_CORE / 2, boxShadow: `${tone.glow}, inset 0px 2px 0px rgba(255,255,255,0.28)` }, pop]}>
        <View style={{ position: 'absolute', inset: 0, borderRadius: BADGE_CORE / 2, overflow: 'hidden', backgroundImage: tone.core }}>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0, borderRadius: BADGE_CORE / 2, backgroundImage: target.core }, towards]} />
        </View>
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Icon name={(showTarget ? !on : on) ? 'shieldCheck' : locked ? 'lock' : 'eye'} size={50} color="#FFFFFF" strokeWidth={2} />
          <Text style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 16, fontWeight: '900', letterSpacing: 1 }}>{t((showTarget ? !on : on) ? 'friction.coreOn' : 'friction.coreOff')}</Text>
        </View>
      </Animated.View>
      <CelebrationBurst trigger={burst} />
    </Pressable>
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' }}>{t(on ? 'friction.blockedBody' : 'friction.visibleBody', { feature })}</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={locked ? 'lock' : 'clock'} size={14} color={on ? c.text3 : c.red} strokeWidth={2.4} />
      <Text style={{ color: on ? c.text3 : c.red, fontSize: 13, lineHeight: 18, fontWeight: '800' }}>{hint}</Text>
    </View>
  </View>;
}

const RING = 176;
const RING_STROKE = 14;
const RING_R = (RING - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

function CountdownRing({ endsAt, left }: { endsAt: number; left: number }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const remaining = useSharedValue(1);
  useEffect(() => {
    const ms = Math.max(0, endsAt - Date.now());
    remaining.set(ms / TURN_OFF_WAIT_MS);
    remaining.set(withTiming(0, { duration: ms, easing: Easing.linear }));
    return () => cancelAnimation(remaining);
  }, [endsAt, remaining]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: RING_CIRC * (1 - remaining.get()) }));
  return <View style={{ alignSelf: 'center', width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', width: RING - 2 * RING_STROKE - 12, height: RING - 2 * RING_STROKE - 12, borderRadius: RING, backgroundColor: c.redSoft }} />
    <Svg width={RING} height={RING} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
      <Defs><LinearGradient id="waitRing" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FF7A7F" /><Stop offset="1" stopColor="#C92A35" /></LinearGradient></Defs>
      <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={c.card2} strokeWidth={RING_STROKE} fill="none" />
      <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RING_R} stroke="url(#waitRing)" strokeWidth={RING_STROKE} strokeLinecap="round" fill="none" strokeDasharray={`${RING_CIRC} ${RING_CIRC}`} animatedProps={ring} />
    </Svg>
    {left > 0
      ? <View style={{ alignItems: 'center' }}>
          <Text accessibilityLiveRegion="polite" style={{ color: c.red, fontSize: 46, lineHeight: 52, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'] }}>{formatCountdown(left)}</Text>
          <Text style={{ color: c.red, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, opacity: 0.8 }}>{t('friction.thinkLabel')}</Text>
        </View>
      : <Icon name="lock" size={44} color={c.red} strokeWidth={2.2} />}
  </View>;
}

/** The sentence with typed letters in green, the first wrong one in red and the next one underlined. */
function TypingTarget({ phrase, input }: { phrase: string; input: string }) {
  const c = useAppTheme();
  const { correct, mistake } = typingProgress(input, phrase);
  const next = phrase.slice(correct, correct + 1);
  return <Text selectable={false} style={{ fontSize: 19, lineHeight: 29, fontWeight: '700', letterSpacing: -0.2, color: c.text3 }}>
    <Text style={{ color: c.mintInk }}>{phrase.slice(0, correct)}</Text>
    {next ? <Text style={mistake ? { color: c.red, backgroundColor: c.redSoft } : { color: c.text, textDecorationLine: 'underline', textDecorationColor: c.accent }}>{next}</Text> : null}
    <Text>{phrase.slice(correct + 1)}</Text>
  </Text>;
}

/** The big safe choice, in the same green as a protected badge. */
function KeepOnButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return <Pressable accessibilityRole="button" accessibilityLabel={t('friction.keepOn')} onPress={onPress} style={({ pressed }) => ({ height: 58, borderRadius: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundImage: BADGE_TONES.on.core, boxShadow: `${BADGE_TONES.on.glow}, inset 0px 2px 0px rgba(255,255,255,0.25)`, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
    <Icon name="shieldCheck" size={22} color="#FFFFFF" strokeWidth={2.3} />
    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 }}>{t('friction.keepOn')}</Text>
  </Pressable>;
}

/** The way out: quiet and outlined while it is locked, solid red once the wait is over. */
function LeaveButton({ title, enabled, danger, onPress }: { title: string; enabled: boolean; danger: boolean; onPress: () => void }) {
  const c = useAppTheme();
  const solid = danger && enabled;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !enabled }} disabled={!enabled} onPress={onPress} style={({ pressed }) => ({ height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: solid ? 0 : 1.5, borderColor: danger ? c.redSoft : c.line, backgroundColor: solid ? c.red : 'transparent', opacity: enabled ? (pressed ? 0.7 : 1) : 0.55 })}>
    <Text style={{ color: solid ? '#FFFFFF' : danger ? c.red : c.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{title}</Text>
  </Pressable>;
}

type Step = 'phrase' | 'wait';
/** More characters than this arriving in one change counts as a paste. */
const PASTE_JUMP = 10;

/**
 * Turning a protection off, as a small game you are meant to lose: see what it costs, type the
 * commitment sentence letter by letter (paste is disabled), then watch a one-minute ring run down
 * with "keep it on" as the main action. `onKeep(engaged)` says whether the user had started.
 */
export function TurnOffSheet({ visible, name, minutesPerDay, onKeep, onTurnOff }: { visible: boolean; name: string; minutesPerDay: number; onKeep: (engaged: boolean) => void; onTurnOff: () => void }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.selectedLanguage);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('phrase');
  const [text, setText] = useState('');
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const phrase = t('friction.phrase');
  // Start fresh each time the sheet opens (adjusting state during render, not in an effect).
  const [openedFor, setOpenedFor] = useState(visible);
  if (visible !== openedFor) { setOpenedFor(visible); if (visible) { setStep('phrase'); setText(''); } }
  useEffect(() => {
    if (!visible || step !== 'wait') return undefined;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [step, visible]);
  const left = step === 'wait' ? secondsLeft(endsAt, now) : TURN_OFF_WAIT_MS / 1000;
  const unlockedOnce = useRef(false);
  useEffect(() => {
    if (step === 'wait' && left === 0 && !unlockedOnce.current) { unlockedOnce.current = true; void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }
    if (step !== 'wait') unlockedOnce.current = false;
  }, [left, step]);
  const progress = typingProgress(text, phrase);
  const matches = phraseMatches(text, phrase);
  const hadMistake = useRef(false);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  // Compared on every keystroke, ahead of React state, so fast typing is never mistaken for a paste.
  const typed = useRef('');
  useEffect(() => { if (visible) typed.current = ''; }, [visible]);
  const onType = (value: string) => {
    // The context menu is hidden, but keyboards and hardware shortcuts can still paste: a jump of several
    // characters at once is not typing, so it is refused and the field keeps what was typed by hand.
    if (value.length - typed.current.length > PASTE_JUMP) {
      setPasteBlocked(true);
      setText(typed.current);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    typed.current = value;
    if (pasteBlocked) setPasteBlocked(false);
    const next = typingProgress(value, phrase);
    if (next.mistake && !hadMistake.current) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else if (!next.mistake && phraseMatches(value, phrase) && !phraseMatches(text, phrase)) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    hadMistake.current = next.mistake;
    setText(value);
  };
  const keep = () => onKeep(step === 'wait' || text.length > 0);
  const year = yearlyValue(minutesPerDay);
  const stepIndex = step === 'phrase' ? 0 : 1;
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const cardBorder = matches ? c.mint : 'transparent';
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={keep}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Pressable accessibilityLabel={t('friction.keepOn')} onPress={keep} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(14,16,32,0.45)' }}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ flexShrink: 1, marginTop: insets.top + 8, backgroundColor: c.card, borderTopLeftRadius: 34, borderTopRightRadius: 34, boxShadow: c.sheetSh, overflow: 'hidden' }}>
          {/* Scrolls only when the keyboard leaves too little room for the whole sheet. */}
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 18, paddingTop: 10, paddingHorizontal: 20, paddingBottom: insets.bottom + 18 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.off, alignSelf: 'center' }} />

          {/* Step dots in the middle, close (= keep it on) on the right. */}
          <View style={{ height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <View accessible accessibilityLabel={t('friction.step', { step: stepIndex + 1 })} style={{ flexDirection: 'row', gap: 6 }}>
              {[0, 1].map((i) => <View key={i} style={{ width: i === stepIndex ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i <= stepIndex ? '#EF4450' : c.card2 }} />)}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('friction.keepOn')} hitSlop={8} onPress={keep} style={({ pressed }) => ({ position: 'absolute', right: 0, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="close" size={18} color={c.text2} strokeWidth={2.4} />
            </Pressable>
          </View>

          {step === 'phrase' ? (focused ? null : <View style={{ alignSelf: 'center', width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: c.redSoft }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundImage: BADGE_TONES.off.core, boxShadow: `${BADGE_TONES.off.glow}, inset 0px 2px 0px rgba(255,255,255,0.28)` }}>
              <Icon name="eye" size={32} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </View>) : <CountdownRing endsAt={endsAt} left={left} />}

          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text accessibilityRole="header" style={{ color: c.text, fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' }}>{t(step === 'wait' ? 'friction.waitTitle' : 'friction.offTitle')}</Text>
            {step === 'wait'
              ? <Text style={{ color: left > 0 ? c.text2 : c.red, fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'center' }}>{t(left > 0 ? 'friction.waitBody' : 'friction.unlocked')}</Text>
              : minutesPerDay > 0
                ? <Text style={{ color: c.text2, fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center' }}>
                    <Text style={{ color: c.red, fontWeight: '800' }}>{t('friction.lose', { time: formatDuration(Math.round(minutesPerDay), locale) })}</Text>{' '}{t('friction.perDayWord')}
                    {'  ·  '}
                    <Text style={{ color: c.red, fontWeight: '800' }}>{t('friction.lossYearValue', { hours: formatInteger(year.hours, locale) })}</Text>{' '}{t('friction.perYearWord')}
                  </Text>
                : <Text style={{ color: c.text2, fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'center' }}>{t('friction.offCostNoNumber', { name })}</Text>}
          </View>

          {step === 'phrase' ? <Pressable accessibilityRole="button" accessibilityLabel={t('friction.typePhrase')} onPress={() => input.current?.focus()} style={{ gap: 14, padding: 18, borderRadius: 24, borderWidth: 2, borderColor: cardBorder, backgroundColor: c.card2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="key" size={14} color={c.text3} strokeWidth={2.4} />
              <Text style={{ flex: 1, color: c.text3, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 }}>{t(focused || text ? 'friction.typePhraseShort' : 'friction.tapToType')}</Text>
              <Text style={{ color: matches ? c.mintInk : progress.mistake ? c.red : c.text3, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{t('friction.typed', { done: progress.correct, total: phrase.length })}</Text>
            </View>
            <TypingTarget phrase={phrase} input={text} />
            <View style={{ height: 8, borderRadius: 4, backgroundColor: c.off, overflow: 'hidden' }}>
              <View style={{ width: `${(progress.correct / phrase.length) * 100}%`, height: 8, borderRadius: 4, backgroundColor: progress.mistake ? c.red : c.mint }} />
            </View>
            <TextInput
              ref={input}
              value={text}
              onChangeText={onType}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              multiline
              placeholder={t('friction.phrasePlaceholder')}
              placeholderTextColor={c.text3}
              contextMenuHidden
              autoCorrect={false}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              accessibilityLabel={t('friction.typePhrase')}
              style={{ minHeight: 56, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: matches ? c.mint : progress.mistake ? c.red : focused ? c.accent : c.line, backgroundColor: c.card, color: c.text, fontSize: 16, lineHeight: 22, textAlignVertical: 'top' }}
            />
            {pasteBlocked ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="info" size={14} color={c.red} strokeWidth={2.4} />
              <Text style={{ flex: 1, color: c.red, fontSize: 12, lineHeight: 16, fontWeight: '700' }}>{t('friction.noPaste')}</Text>
            </View> : null}
          </Pressable> : null}

          <View style={{ gap: 10 }}>
            <KeepOnButton onPress={keep} />
            {step === 'phrase'
              ? <LeaveButton title={t('friction.continue')} enabled={matches} danger={false} onPress={() => { input.current?.blur(); setEndsAt(Date.now() + TURN_OFF_WAIT_MS); setNow(Date.now()); setStep('wait'); }} />
              : <LeaveButton title={left > 0 ? t('friction.turnOffIn', { time: formatCountdown(left) }) : t('friction.turnOff')} enabled={left === 0} danger onPress={onTurnOff} />}
          </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>;
}
