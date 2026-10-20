import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { ActionButton, Note } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import { formatDuration } from '../../utils/formatDuration';
import { formatInteger } from '../onboarding/dayBudget';
import { yearlyValue } from '../savings/savings';
import { HOLD_TO_ENABLE_MS, TURN_OFF_WAIT_MS, formatCountdown, phraseMatches, secondsLeft, typingProgress } from './turnOffFriction';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PILL_W = 148;
const PILL_H = 40;

/**
 * "Charge" button: holding it sweeps a gradient across with a haptic tick each quarter, and turns the
 * protection on once full (HOLD_TO_ENABLE_MS). Letting go early drains it.
 */
export function HoldToEnable({ label, onEnabled, disabled = false, onDisabledPress }: { label: string; onEnabled: () => void; disabled?: boolean; onDisabledPress?: () => void }) {
  const c = useAppTheme();
  const { t } = useTranslation();
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
    progress.set(withTiming(1, { duration: HOLD_TO_ENABLE_MS, easing: Easing.inOut(Easing.quad) }));
    for (const step of [0.25, 0.5, 0.75]) timers.current.push(setTimeout(() => { void Haptics.impactAsync(step < 0.75 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium); }, HOLD_TO_ENABLE_MS * step));
    timers.current.push(setTimeout(() => {
      timers.current = [];
      setHolding(false);
      scale.set(withSequence(withSpring(1.1, { damping: 8, stiffness: 400 }), withSpring(1)));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onEnabled();
    }, HOLD_TO_ENABLE_MS));
  };
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

const RING = 168;
const RING_STROKE = 12;
const RING_R = (RING - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

function CountdownRing({ endsAt, left }: { endsAt: number; left: number }) {
  const c = useAppTheme();
  const remaining = useSharedValue(1);
  useEffect(() => {
    const ms = Math.max(0, endsAt - Date.now());
    remaining.set(ms / TURN_OFF_WAIT_MS);
    remaining.set(withTiming(0, { duration: ms, easing: Easing.linear }));
    return () => cancelAnimation(remaining);
  }, [endsAt, remaining]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: RING_CIRC * (1 - remaining.get()) }));
  return <View style={{ alignSelf: 'center', width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={RING} height={RING} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
      <Defs><LinearGradient id="waitRing" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={c.accent} /><Stop offset="1" stopColor={c.red} /></LinearGradient></Defs>
      <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={c.card2} strokeWidth={RING_STROKE} fill="none" />
      <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RING_R} stroke="url(#waitRing)" strokeWidth={RING_STROKE} strokeLinecap="round" fill="none" strokeDasharray={`${RING_CIRC} ${RING_CIRC}`} animatedProps={ring} />
    </Svg>
    {left > 0
      ? <Text accessibilityLiveRegion="polite" style={{ color: c.text, fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'] }}>{formatCountdown(left)}</Text>
      : <Icon name="lock" size={40} color={c.red} strokeWidth={2.2} />}
  </View>;
}

/** The sentence with typed letters in green, the first wrong one in red and the next one underlined. */
function TypingTarget({ phrase, input }: { phrase: string; input: string }) {
  const c = useAppTheme();
  const { correct, mistake } = typingProgress(input, phrase);
  const next = phrase.slice(correct, correct + 1);
  return <Text selectable={false} style={{ fontSize: 16, lineHeight: 24, fontWeight: '700', color: c.text3 }}>
    <Text style={{ color: c.mintInk }}>{phrase.slice(0, correct)}</Text>
    {next ? <Text style={mistake ? { color: c.red, backgroundColor: c.redSoft } : { color: c.text, textDecorationLine: 'underline', textDecorationColor: c.accent }}>{next}</Text> : null}
    <Text>{phrase.slice(correct + 1)}</Text>
  </Text>;
}

type Step = 'phrase' | 'wait';

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
  const onType = (value: string) => {
    const next = typingProgress(value, phrase);
    if (next.mistake && !hadMistake.current) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else if (!next.mistake && phraseMatches(value, phrase) && !phraseMatches(text, phrase)) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    hadMistake.current = next.mistake;
    setText(value);
  };
  const keep = () => onKeep(step === 'wait' || text.length > 0);
  const year = yearlyValue(minutesPerDay);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={keep}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Pressable accessibilityLabel={t('friction.keepOn')} onPress={keep} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(14,16,32,0.45)' }}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ gap: 14, backgroundColor: c.card, paddingTop: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, boxShadow: c.sheetSh }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.off, alignSelf: 'center' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center', backgroundColor: c.soft }}>
              <Text style={{ color: c.ink, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 }}>{t('friction.step', { step: step === 'phrase' ? 1 : 2 })}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[0, 1].map((i) => <View key={i} style={{ width: (step === 'phrase' ? 0 : 1) === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: (step === 'phrase' ? 0 : 1) >= i ? c.accent : c.off }} />)}
            </View>
          </View>
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 }}>{t(step === 'wait' ? 'friction.waitTitle' : 'friction.offTitle')}</Text>

          {minutesPerDay > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: c.redSoft }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card }}><Icon name="clock" size={22} color={c.red} strokeWidth={2.2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.red, fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6 }}>{t('friction.lose', { time: formatDuration(Math.round(minutesPerDay), locale) })}</Text>
              <Text style={{ color: c.red, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{t('friction.losePerDay')} · {t('friction.loseYear', { hours: formatInteger(year.hours, locale) })}</Text>
            </View>
          </View> : <Note tone="amber" icon="info">{t('friction.offCostNoNumber', { name })}</Note>}

          {step === 'phrase' ? <>
            <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>{t('friction.typePhrase')}</Text>
            <View style={{ gap: 10, padding: 14, borderRadius: 18, backgroundColor: c.card2 }}>
              <TypingTarget phrase={phrase} input={text} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.off, overflow: 'hidden' }}>
                  <View style={{ width: `${(progress.correct / phrase.length) * 100}%`, height: 6, borderRadius: 3, backgroundColor: progress.mistake ? c.red : c.mint }} />
                </View>
                <Text style={{ color: c.text3, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{t('friction.typed', { done: progress.correct, total: phrase.length })}</Text>
              </View>
            </View>
            <TextInput
              value={text}
              onChangeText={onType}
              placeholder={t('friction.phrasePlaceholder')}
              placeholderTextColor={c.text3}
              multiline
              contextMenuHidden
              autoCorrect={false}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              accessibilityLabel={t('friction.typePhrase')}
              style={{ minHeight: 64, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: matches ? c.mint : progress.mistake ? c.red : c.border, backgroundColor: c.card, color: c.text, fontSize: 15, lineHeight: 21, textAlignVertical: 'top' }}
            />
            <ActionButton title={t('friction.keepOn')} icon={<Icon name="shieldCheck" size={20} color="#FFFFFF" strokeWidth={2.2} />} onPress={keep} />
            <ActionButton variant="outline" compact disabled={!matches} title={t('friction.continue')} onPress={() => { setEndsAt(Date.now() + TURN_OFF_WAIT_MS); setNow(Date.now()); setStep('wait'); }} />
          </> : <>
            <CountdownRing endsAt={endsAt} left={left} />
            <Text style={{ color: left > 0 ? c.text2 : c.red, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' }}>{t(left > 0 ? 'friction.waitBody' : 'friction.unlocked')}</Text>
            <ActionButton title={t('friction.keepOn')} icon={<Icon name="shieldCheck" size={20} color="#FFFFFF" strokeWidth={2.2} />} onPress={keep} />
            <ActionButton variant="destructive" compact disabled={left > 0} title={left > 0 ? t('friction.turnOffIn', { time: formatCountdown(left) }) : t('friction.turnOff')} onPress={onTurnOff} />
          </>}
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>;
}
