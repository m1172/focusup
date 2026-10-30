import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { BackButton } from '../../components/ui';
import { useAppTheme } from '../../theme';

/** Authentication is the required final onboarding step. */
export const ONBOARDING_STEPS = 5;

/** Back button + a progress bar that grows from the previous step on mount. */
/** `step` may be fractional (per-app questions); `from` is where the bar starts, the previous step by default. */
export function OnboardingHeader({ step, from, total = ONBOARDING_STEPS, back = true }: { step: number; from?: number; total?: number; back?: boolean }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? step / total : (from ?? step - 1) / total);
  useEffect(() => {
    progress.value = withTiming(step / total, { duration: reducedMotion ? 0 : 700, easing: Easing.out(Easing.cubic) });
  }, [progress, reducedMotion, step, total]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
    {back ? <BackButton label={t('back')} /> : <View style={{ width: 44 }} />}
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t('onboarding.step', { step: Math.ceil(step), total })} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.off, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundImage: c.grad }, fill]} />
    </View>
    <View style={{ width: 44 }} />
  </View>;
}

/** Title + body that slide in one after the other. */
export function StepTitle({ title, body, delay = 0 }: { title: string; body?: string; delay?: number }) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const enter = (d: number) => (reducedMotion ? undefined : FadeInDown.delay(delay + d).duration(500).easing(Easing.out(Easing.cubic)));
  return <View style={{ gap: 10 }}>
    <Animated.View entering={enter(0)}><Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{title}</Text></Animated.View>
    {body ? <Animated.View entering={enter(90)}><Text style={{ color: c.text2, fontSize: 16, lineHeight: 23, fontWeight: '500' }}>{body}</Text></Animated.View> : null}
  </View>;
}

/** Smoothly counts from the last shown value to `to` (ease-out quart). Re-runs when `to` changes. */
export function CountUp({ to, duration = 1600, delay = 0, format, style, onDone, numberOfLines, adjustsFontSizeToFit, minimumFontScale }: { to: number; duration?: number; delay?: number; format: (value: number) => string; style?: StyleProp<TextStyle>; onDone?: () => void; numberOfLines?: number; adjustsFontSizeToFit?: boolean; minimumFontScale?: number }) {
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const shown = useRef(0);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    if (reducedMotion) { shown.current = to; done.current?.(); return; }
    const from = shown.current;
    let frame = 0;
    let start: number | undefined;
    const tick = (time: number) => {
      if (start === undefined) start = time;
      const p = Math.min(1, (time - start) / duration);
      const next = from + (to - from) * (1 - Math.pow(1 - p, 4));
      shown.current = next;
      setValue(next);
      if (p < 1) frame = requestAnimationFrame(tick);
      else done.current?.();
    };
    const timer = setTimeout(() => { frame = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [delay, duration, reducedMotion, to]);
  return <Text numberOfLines={numberOfLines} adjustsFontSizeToFit={adjustsFontSizeToFit} minimumFontScale={minimumFontScale} style={[{ fontVariant: ['tabular-nums'] }, style]}>{format(reducedMotion ? to : value)}</Text>;
}

/** Large value that gives a small spring "pop" each time it changes. */
export function PoppingValue({ children, value, align = 'center', stretch = false }: { children: ReactNode; value: number; align?: 'center' | 'flex-start'; stretch?: boolean }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!reducedMotion) scale.value = withSequence(withTiming(1.06, { duration: 70 }), withSpring(1, { damping: 12, stiffness: 260 }));
  }, [reducedMotion, scale, value]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[{ alignItems: align, alignSelf: stretch ? 'stretch' : undefined, transformOrigin: align === 'center' ? 'center' : 'left' }, style]}>{children}</Animated.View>;
}

const TICK = 14;

/**
 * Horizontal ruler picker. Native ScrollView snapping keeps it at 60/120 fps on both platforms;
 * a selection haptic fires on every new value like an iOS picker wheel.
 */
export function RulerPicker({ min, max, step, value, onChange, isMajor, majorLabel, accessibilityLabel, accessibilityValue }: {
  min: number; max: number; step: number; value: number; onChange: (value: number) => void;
  isMajor: (value: number) => boolean; majorLabel: (value: number) => string; accessibilityLabel: string; accessibilityValue: string;
}) {
  const c = useAppTheme();
  const [width, setWidth] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);
  const last = useRef(value);
  const placed = useRef(false);
  const programmatic = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = Math.round((max - min) / step) + 1;
  const indexOf = (v: number) => Math.round((v - min) / step);
  const valueAt = (i: number) => Math.round((min + Math.min(count - 1, Math.max(0, i)) * step) * 1000) / 1000;
  // A value set from outside (an answer chip) glides the ruler there without per-tick haptics.
  useEffect(() => {
    if (value === last.current || !placed.current) return;
    last.current = value;
    if (programmatic.current) clearTimeout(programmatic.current);
    programmatic.current = setTimeout(() => { programmatic.current = null; }, 450);
    scroller.current?.scrollTo({ x: Math.round((value - min) / step) * TICK, animated: true });
  }, [min, step, value]);
  useEffect(() => () => { if (programmatic.current) clearTimeout(programmatic.current); }, []);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (programmatic.current) return;
    const next = valueAt(Math.round(event.nativeEvent.contentOffset.x / TICK));
    if (next !== last.current) { last.current = next; void Haptics.selectionAsync(); onChange(next); }
  };
  const nudge = (direction: 1 | -1) => {
    const next = valueAt(indexOf(last.current) + direction);
    scroller.current?.scrollTo({ x: indexOf(next) * TICK, animated: true });
  };
  return <View
    accessible
    accessibilityRole="adjustable"
    accessibilityLabel={accessibilityLabel}
    accessibilityValue={{ text: accessibilityValue }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={(event) => nudge(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    style={{ height: 86 }}
  >
    {width > 0 ? <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={TICK}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onScrollBeginDrag={() => { if (programmatic.current) { clearTimeout(programmatic.current); programmatic.current = null; } }}
      onContentSizeChange={() => {
        if (placed.current) return;
        placed.current = true;
        scroller.current?.scrollTo({ x: indexOf(value) * TICK, animated: false });
      }}
      contentContainerStyle={{ paddingHorizontal: width / 2 - TICK / 2, alignItems: 'flex-start' }}
    >
      {Array.from({ length: count }, (_, i) => {
        const major = isMajor(valueAt(i));
        return <View key={i} style={{ width: TICK, alignItems: 'center' }}>
          <View style={{ marginTop: major ? 8 : 16, width: 2, height: major ? 34 : 18, borderRadius: 1, backgroundColor: major ? c.text3 : c.off }} />
          {major ? <Text numberOfLines={1} style={{ position: 'absolute', top: 50, width: 48, left: TICK / 2 - 24, textAlign: 'center', color: c.text3, fontSize: 12, fontWeight: '700' }}>{majorLabel(valueAt(i))}</Text> : null}
        </View>;
      })}
    </ScrollView> : null}
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, width: 72, top: 0, bottom: 0, backgroundImage: `linear-gradient(90deg, ${c.bg}, ${c.bg}00)` }} />
    <View pointerEvents="none" style={{ position: 'absolute', right: 0, width: 72, top: 0, bottom: 0, backgroundImage: `linear-gradient(270deg, ${c.bg}, ${c.bg}00)` }} />
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: width / 2 - 2, width: 4, height: 50, borderRadius: 2, backgroundColor: c.accent, boxShadow: c.sw }} />
  </View>;
}

export type AnswerOption = { key: string; label: string; value: number; selected: boolean };

/** Tap-to-pick answers in a 3-column grid; the selected one fills with the brand gradient. */
export function AnswerChips({ options, onSelect, delay = 0 }: { options: AnswerOption[]; onSelect: (value: number) => void; delay?: number }) {
  const reducedMotion = useReducedMotion();
  return <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
    {options.map((option, i) => <Animated.View key={option.key} entering={reducedMotion ? undefined : FadeInDown.delay(delay + i * 45).duration(420).easing(Easing.out(Easing.cubic))} style={{ width: '31.5%' }}>
      <AnswerChip option={option} onSelect={onSelect} />
    </Animated.View>)}
  </View>;
}

function AnswerChip({ option, onSelect }: { option: AnswerOption; onSelect: (value: number) => void }) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Pressable
    accessibilityRole="radio"
    accessibilityState={{ selected: option.selected }}
    accessibilityLabel={option.label}
    onPressIn={() => { if (!reducedMotion) scale.set(withTiming(0.94, { duration: 80 })); }}
    onPressOut={() => { if (!reducedMotion) scale.set(withSpring(1, { damping: 10, stiffness: 320 })); }}
    onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(option.value); }}
  >
    <Animated.View style={[{ height: 52, borderRadius: 18, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: option.selected ? undefined : c.card, backgroundImage: option.selected ? c.grad : undefined, boxShadow: option.selected ? c.glow : c.sh }, press]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: option.selected ? '#FFFFFF' : c.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{option.label}</Text>
    </Animated.View>
  </Pressable>;
}
