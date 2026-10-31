import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { BackButton } from '../../components/ui';
import { useAppTheme } from '../../theme';

/**
 * Progress steps after the hook: your time, age, why, life in weeks, reveal, instead, how it works,
 * goals, commit, referral, account. Authentication is the required final step.
 */
export const ONBOARDING_STEPS = 10;

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

/**
 * Tap-to-pick answers; the selected ones fill with the brand gradient. Three short chips per row by default;
 * `columns` 1 or 2 fit longer, two-line labels. `multiple` makes them checkboxes with a check mark.
 */
export function AnswerChips({ options, onSelect, delay = 0, columns = 3, multiple = false }: { options: AnswerOption[]; onSelect: (value: number) => void; delay?: number; columns?: 1 | 2 | 3; multiple?: boolean }) {
  const reducedMotion = useReducedMotion();
  const width = columns === 3 ? '31.5%' : columns === 2 ? '48.5%' : '100%';
  return <View accessibilityRole={multiple ? undefined : 'radiogroup'} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
    {options.map((option, i) => <Animated.View key={option.key} entering={reducedMotion ? undefined : FadeInDown.delay(delay + i * 45).duration(420).easing(Easing.out(Easing.cubic))} style={{ width }}>
      <AnswerChip option={option} onSelect={onSelect} wide={columns < 3} multiple={multiple} />
    </Animated.View>)}
  </View>;
}

function AnswerChip({ option, onSelect, wide, multiple }: { option: AnswerOption; onSelect: (value: number) => void; wide: boolean; multiple: boolean }) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ink = option.selected ? '#FFFFFF' : c.text;
  return <Pressable
    accessibilityRole={multiple ? 'checkbox' : 'radio'}
    accessibilityState={multiple ? { checked: option.selected } : { selected: option.selected }}
    accessibilityLabel={option.label}
    onPressIn={() => { if (!reducedMotion) scale.set(withTiming(wide ? 0.97 : 0.94, { duration: 80 })); }}
    onPressOut={() => { if (!reducedMotion) scale.set(withSpring(1, { damping: 10, stiffness: 320 })); }}
    onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(option.value); }}
  >
    <Animated.View style={[{ minHeight: wide ? 56 : 52, borderRadius: 18, paddingHorizontal: wide ? 16 : 6, paddingVertical: wide ? 10 : 0, flexDirection: 'row', alignItems: 'center', justifyContent: wide ? 'space-between' : 'center', gap: 10, backgroundColor: option.selected ? undefined : c.card, backgroundImage: option.selected ? c.grad : undefined, boxShadow: option.selected ? c.glow : c.sh }, press]}>
      {wide
        ? <Text numberOfLines={2} style={{ flex: 1, color: ink, fontSize: 15, lineHeight: 20, fontWeight: '700' }}>{option.label}</Text>
        : <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: ink, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{option.label}</Text>}
      {wide && multiple ? <View style={{ width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: option.selected ? 'rgba(255,255,255,0.22)' : undefined, borderWidth: option.selected ? 0 : 1.5, borderColor: c.off }}>
        {option.selected ? <Icon name="check" size={15} color="#FFFFFF" strokeWidth={3} /> : null}
      </View> : null}
    </Animated.View>
  </Pressable>;
}

const WHEEL_ROW = 52;
const WHEEL_ROWS = 5;

/**
 * Vertical wheel like the iOS picker: native snapping keeps it smooth, and a selection haptic fires on every
 * new value. Rows fade and shrink with distance from the centre band.
 */
export function WheelPicker({ min, max, value, onChange, format, accessibilityLabel }: {
  min: number; max: number; value: number; onChange: (value: number) => void; format: (value: number) => string; accessibilityLabel: string;
}) {
  const c = useAppTheme();
  const scroller = useRef<ScrollViewInstance>(null);
  const last = useRef(value);
  const placed = useRef(false);
  const count = max - min + 1;
  const valueAt = (i: number) => min + Math.min(count - 1, Math.max(0, i));
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = valueAt(Math.round(event.nativeEvent.contentOffset.y / WHEEL_ROW));
    if (next !== last.current) { last.current = next; void Haptics.selectionAsync(); onChange(next); }
  };
  const nudge = (direction: 1 | -1) => {
    const next = valueAt(last.current - min + direction);
    scroller.current?.scrollTo({ y: (next - min) * WHEEL_ROW, animated: true });
  };
  const pad = WHEEL_ROW * Math.floor(WHEEL_ROWS / 2);
  return <View
    accessible
    accessibilityRole="adjustable"
    accessibilityLabel={accessibilityLabel}
    accessibilityValue={{ text: format(value) }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={(event) => nudge(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    style={{ height: WHEEL_ROW * WHEEL_ROWS }}
  >
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: pad, height: WHEEL_ROW, borderRadius: 18, backgroundColor: c.soft, boxShadow: c.isDark ? c.ringSoft : undefined }} />
    <ScrollView
      ref={scroller}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ROW}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onContentSizeChange={() => {
        if (placed.current) return;
        placed.current = true;
        scroller.current?.scrollTo({ y: (value - min) * WHEEL_ROW, animated: false });
      }}
      contentContainerStyle={{ paddingVertical: pad }}
    >
      {Array.from({ length: count }, (_, i) => {
        const distance = Math.abs(valueAt(i) - value);
        return <Pressable key={i} accessible={false} onPress={() => scroller.current?.scrollTo({ y: i * WHEEL_ROW, animated: true })} style={{ height: WHEEL_ROW, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: distance === 0 ? c.ink : c.text2, fontSize: distance === 0 ? 32 : 24 - Math.min(2, distance) * 2, fontWeight: '800', opacity: distance === 0 ? 1 : Math.max(0.2, 0.7 - distance * 0.2), fontVariant: ['tabular-nums'] }}>{format(valueAt(i))}</Text>
        </Pressable>;
      })}
    </ScrollView>
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: WHEEL_ROW * 1.6, backgroundImage: `linear-gradient(180deg, ${c.bg}, ${c.bg}00)` }} />
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: WHEEL_ROW * 1.6, backgroundImage: `linear-gradient(0deg, ${c.bg}, ${c.bg}00)` }} />
  </View>;
}
