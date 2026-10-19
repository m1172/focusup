import { BottomNavigation } from './BottomNavigation';
import { Text } from './Typography';
import { Icon, type IconName } from './Icon';
import { type PropsWithChildren, type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows, useAppTheme, type AppPalette } from '../theme';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { ScreenStatusBar } from './ScreenStatusBar';

/** Bottom offset of the floating tab bar (26px on a 34px home-indicator device). */
export function tabBarBottom(insetBottom: number) { return Math.max(insetBottom - 8, 12); }

/**
 * Screen shell: safe-area top, 24px gutters, the design's radial background glow,
 * optional floating tab bar and pinned footer CTA.
 * `glow` is the glow height in px; `glowDarkOnly` matches screens that only glow in dark mode.
 */
export function Screen({ children, scroll = true, style, contentStyle, footer, navigation = false, glow = 330, glowDarkOnly = false }: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; footer?: ReactNode; navigation?: boolean; glow?: number | false; glowDarkOnly?: boolean }>) {
  const c = useAppTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const tabbed = navigation || segments.includes('(tabs)');
  const reducedMotion = useReducedMotion();
  const [focusCycle, setFocusCycle] = useState(0);
  useFocusEffect(useCallback(() => {
    setFocusCycle((cycle) => cycle + 1);
  }, []));
  const contentAnimation = reducedMotion ? undefined : FadeInDown.duration(280).easing(Easing.out(Easing.cubic));
  const showGlow = glow !== false && (!glowDarkOnly || c.isDark);
  return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: c.bg }, style]}>
    <ScreenStatusBar />
    {showGlow ? <BackgroundGlow height={glow} /> : null}
    {scroll ? <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1, paddingBottom: tabbed ? tabBarBottom(insets.bottom) + 68 + 24 : footer ? 20 : insets.bottom + 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><Animated.View key={focusCycle} entering={contentAnimation} style={[styles.content, contentStyle]}>{children}</Animated.View></ScrollView> : <Animated.View key={focusCycle} entering={contentAnimation} style={styles.screen}>{children}</Animated.View>}
    {navigation ? <BottomNavigation /> : null}
    {footer ? <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 0) + 20 }}>{footer}</View> : null}
  </SafeAreaView>;
}

/** radial-gradient(60% 100% at 50% 0%, accent, transparent 70%) pinned to the top of the screen. */
export function BackgroundGlow({ height = 330 }: { height?: number }) {
  const c = useAppTheme();
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height, backgroundImage: c.bgGlow }} />;
}

export function CircleButton({ onPress, label, icon, iconSize = 22, strokeWidth = 2.2, style }: { onPress: () => void; label: string; icon: IconName; iconSize?: number; strokeWidth?: number; style?: StyleProp<ViewStyle> }) {
  const c = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={onPress} style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, boxShadow: c.sh, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }, style]}>
    <Icon name={icon} size={iconSize} color={c.text} strokeWidth={strokeWidth} />
  </Pressable>;
}

export function BackButton({ onPress, label = 'Back' }: { onPress?: () => void; label?: string }) {
  return <CircleButton label={label} icon="back" onPress={onPress ?? (() => router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />;
}

/** Page title. `size="large"` (32/40) is the tab-screen title, default (30/36) for detail screens. */
export function Heading({ title, subtitle, action, size = 'default' }: { title: string; subtitle?: string; action?: ReactNode; size?: 'default' | 'large' | 'card' }) {
  const c = useAppTheme();
  const type = size === 'large' ? { fontSize: 32, lineHeight: 40, letterSpacing: -1.12 } : size === 'card' ? { fontSize: 18, lineHeight: 24, letterSpacing: -0.36 } : { fontSize: 30, lineHeight: 36, letterSpacing: -0.9 };
  return <View style={{ gap: 4 }}>
    <View style={[styles.headingRow, size === 'card' && { minHeight: 0 }]}><Text accessibilityRole="header" style={{ flex: 1, color: c.text, fontWeight: '800', ...type }}>{title}</Text>{action}</View>
    {subtitle ? <Text style={{ color: c.text2, fontSize: size === 'card' ? 14 : 15, lineHeight: size === 'card' ? 20 : 22, fontWeight: '500' }}>{subtitle}</Text> : null}
  </View>;
}

export function SectionTitle({ title, right, size = 20 }: { title: string; right?: ReactNode; size?: 18 | 20 }) {
  const c = useAppTheme();
  return <View style={[styles.sectionTitle, { minHeight: size === 20 ? 28 : 24 }]}><Text style={{ color: c.text, fontSize: size, lineHeight: size === 20 ? 28 : 24, fontWeight: '800', letterSpacing: -0.02 * size }}>{title}</Text>{right}</View>;
}

/** Uppercase group label above a settings card. */
export function GroupLabel({ title }: { title: string }) {
  const c = useAppTheme();
  return <Text style={{ height: 22, paddingLeft: 6, fontSize: 13, lineHeight: 22, fontWeight: '800', letterSpacing: 0.52, textTransform: 'uppercase', color: c.text2 }}>{title}</Text>;
}

export function Card({ children, style, gradient = false }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; gradient?: boolean }>) {
  const c = useAppTheme();
  if (gradient) return <HeroCard style={style}>{children}</HeroCard>;
  return <View style={[styles.card, { backgroundColor: c.card, boxShadow: c.sh }, style]}>{children}</View>;
}

/** The violet hero card with its soft corner orb. */
export function HeroCard({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const c = useAppTheme();
  return <View style={[{ borderRadius: 30, padding: 22, backgroundImage: c.hero, boxShadow: c.heroSh, overflow: 'hidden' }, style]}>
    <View pointerEvents="none" style={{ position: 'absolute', right: -50, top: -70, width: 220, height: 220, borderRadius: 110, backgroundImage: c.heroOrb }} />
    {children}
  </View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive';

export function ActionButton({
  title,
  onPress,
  secondary = false,
  ghost = false,
  variant,
  disabled = false,
  icon,
  arrow = false,
  compact = false,
  style,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  ghost?: boolean;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: ReactNode;
  arrow?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useAppTheme();
  const kind: ButtonVariant | 'ghost' = ghost ? 'ghost' : variant ?? (secondary ? 'secondary' : 'primary');
  const surface: ViewStyle = disabled
    ? { backgroundColor: c.card2 }
    : kind === 'primary' ? { backgroundImage: c.grad, boxShadow: compact ? undefined : c.glow }
      : kind === 'secondary' ? { backgroundColor: c.soft }
        : kind === 'outline' ? { borderWidth: 1.5, borderColor: c.off }
          : kind === 'destructive' ? { backgroundColor: c.redSoft } : {};
  const color = disabled ? c.text3 : kind === 'primary' ? '#FFFFFF' : kind === 'outline' ? c.text : kind === 'destructive' ? c.red : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        compact && { minHeight: 48, borderRadius: 16 },
        surface,
        { opacity: pressed ? 0.86 : 1 },
        style,
      ]}
    >
      {icon}
      <Text style={{ color, fontSize: compact ? 15 : 17, fontWeight: '700', letterSpacing: compact ? 0 : -0.17, flexShrink: 1, textAlign: 'center' }}>{title}</Text>
      {arrow ? <Icon name="arrowRight" size={20} color={color} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}

/** 52×32 switch. On: gradient track + glow. Off: grey track. Locked: grey track, knob kept on. */
export function Toggle({ value, onChange, label, disabled = false, onDisabledPress }: { value: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean; onDisabledPress?: () => void }) {
  const c = useAppTheme();
  const active = value && !disabled;
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} disabled={disabled && !onDisabledPress} hitSlop={8} onPress={() => {
    if (disabled) { onDisabledPress?.(); return; }
    void Haptics.selectionAsync(); onChange(!value);
  }} style={({ pressed }) => ({ width: 52, height: 32, borderRadius: 16, flexShrink: 0, opacity: pressed ? 0.8 : 1, backgroundColor: active ? undefined : c.off, backgroundImage: active ? c.grad : undefined, boxShadow: active ? c.sw : undefined })}>
    <View style={{ position: 'absolute', top: 3, left: value ? 23 : 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', boxShadow: c.knobSh }} />
  </Pressable>;
}

export type TileTone = 'accent' | 'blue' | 'red' | 'mint' | 'neutral';
export function toneColors(c: AppPalette, tone: TileTone) {
  return tone === 'blue' ? { bg: c.blueSoft, fg: c.blue } : tone === 'red' ? { bg: c.redSoft, fg: c.red } : tone === 'mint' ? { bg: c.mintSoft, fg: c.mintInk } : tone === 'neutral' ? { bg: c.card2, fg: c.text2 } : { bg: c.soft, fg: c.ink };
}

/** Rounded-square icon tile used in list rows. */
export function IconTile({ name, tone = 'accent', size = 34 }: { name: IconName; tone?: TileTone; size?: 34 | 36 | 44 }) {
  const c = useAppTheme();
  const colors = toneColors(c, tone);
  return <View style={{ width: size, height: size, borderRadius: size === 44 ? 14 : size === 36 ? 11 : 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={size === 44 ? 24 : size === 36 ? 20 : 19} color={colors.fg} /></View>;
}

/** Settings-style row: 52px, tile, label, value + chevron or a control. Divider below every row but the last. */
export function SettingRow({
  icon,
  title,
  subtitle,
  value,
  right,
  onPress,
  chevron,
  last = false,
  badge,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
  badge?: ReactNode;
}) {
  const c = useAppTheme();
  const showChevron = chevron ?? (Boolean(onPress) && !right);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { minHeight: 53, borderBottomColor: c.line, borderBottomWidth: 1 },
        pressed && onPress ? { opacity: 0.7 } : null,
      ]}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flexShrink: 1, color: c.text, fontSize: 16, lineHeight: 20, fontWeight: '700' }}>{title}</Text>
          {badge}
        </View>
        {subtitle ? <Text style={{ color: c.text2, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={{ color: c.text2, fontSize: 15, fontWeight: '600' }}>{value}</Text> : null}
      {right}
      {showChevron ? <Icon name="chevron" size={18} color={c.text3} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}

/** Small gradient "PRO" label for locked features. */
export function ProBadge() {
  const c = useAppTheme();
  return <View style={{ height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundImage: c.grad, justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>PRO</Text></View>;
}

export function Pill({ label, active = false, variant }: { label: string; active?: boolean; variant?: 'success' | 'danger' | 'muted' | 'primary' }) {
  const c = useAppTheme();
  const tone = variant === 'danger' ? { bg: c.redSoft, fg: c.red, dot: c.red }
    : variant === 'primary' ? { bg: c.soft, fg: c.ink, dot: c.accent }
      : variant === 'success' || (active && !variant) ? { bg: c.mintSoft, fg: c.mintInk, dot: c.mint }
        : { bg: c.card2, fg: c.text2, dot: c.text3 };
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.dot }} />
      <Text style={{ color: tone.fg, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/** Status line with a coloured dot: "• Tozalangan". */
export function StatusDot({ on, label, size = 12 }: { on: boolean; label: string; size?: 12 | 13 }) {
  const c = useAppTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? c.mint : c.text3 }} />
    <Text numberOfLines={1} style={{ flexShrink: 1, color: on ? c.mintInk : c.text2, fontSize: size, lineHeight: 16, fontWeight: '700' }}>{label}</Text>
  </View>;
}

/** Tinted note (mint = reassurance, accent = info, amber = warning, red = error). */
export function Note({ children, tone = 'mint', icon, style, textStyle }: PropsWithChildren<{ tone?: 'mint' | 'accent' | 'amber' | 'red'; icon?: IconName; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }>) {
  const c = useAppTheme();
  const t = tone === 'accent' ? { bg: c.soft, fg: c.ink, ring: c.ringSoft } : tone === 'amber' ? { bg: c.amberSoft, fg: c.amber, ring: '' } : tone === 'red' ? { bg: c.redSoft, fg: c.red, ring: '' } : { bg: c.mintSoft, fg: c.mintInk, ring: c.isDark ? '0px 0px 0px 1px rgba(52,211,160,0.16)' : '' };
  return <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 22, backgroundColor: t.bg, boxShadow: t.ring || undefined }, style]}>
    {icon ? <View style={{ marginTop: 1 }}><Icon name={icon} size={22} color={t.fg} strokeWidth={2} /></View> : null}
    <Text style={[{ flex: 1, color: t.fg, fontSize: 14, lineHeight: 20, fontWeight: '600' }, textStyle]}>{children}</Text>
  </View>;
}

export function AlertBanner({ title, message, visible = true }: { title: string; message: string; visible?: boolean }) {
  const c = useAppTheme();
  if (!visible) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.soft, boxShadow: c.ringSoft || undefined }}>
      <Icon name="circleCheck" size={20} color={c.ink} strokeWidth={2} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.ink, fontWeight: '700', fontSize: 14, lineHeight: 19 }}>{title}</Text>
        {message ? <Text style={{ color: c.ink, opacity: 0.85, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{message}</Text> : null}
      </View>
    </View>
  );
}

/** Segmented control (Kun / Hafta / Oy / Yil, System / Light / Dark). */
export function Segmented<T extends string>({ options, value, onChange, height = 36 }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; height?: 36 | 40 }) {
  const c = useAppTheme();
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: 18, backgroundColor: c.seg }}>
    {options.map((option) => {
      const selected = option.value === value;
      return <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => { void Haptics.selectionAsync(); onChange(option.value); }} style={{ flex: 1, height, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.segOn : 'transparent', boxShadow: selected ? c.segSh : undefined }}>
        <Text style={{ color: selected ? c.text : c.text2, fontSize: 14, fontWeight: selected ? '800' : '700' }}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

/** Bottom sheet: 30px top radius, grabber, title, body and actions. */
export function Sheet({ visible, onClose, title, message, children }: PropsWithChildren<{ visible: boolean; onClose: () => void; title: string; message?: string }>) {
  const c = useAppTheme();
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable accessibilityLabel={title} onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(14,16,32,0.4)' }}>
      <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: c.card, paddingTop: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, boxShadow: c.sheetSh }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.off, alignSelf: 'center' }} />
        <Text accessibilityRole="header" style={{ marginTop: 14, color: c.text, fontSize: 18, lineHeight: 24, fontWeight: '800' }}>{title}</Text>
        {message ? <Text style={{ marginTop: 4, color: c.text2, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{message}</Text> : null}
        <View style={{ marginTop: 16, gap: 10 }}>{children}</View>
      </Pressable>
    </Pressable>
  </Modal>;
}

/** Two side-by-side sheet buttons: "Bekor" (soft) + primary. */
export function SheetActions({ cancel, confirm, onCancel, onConfirm }: { cancel: string; confirm: string; onCancel: () => void; onConfirm: () => void }) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>
    <ActionButton compact variant="secondary" title={cancel} onPress={onCancel} style={{ flex: 1 }} />
    <ActionButton compact title={confirm} onPress={onConfirm} style={{ flex: 1 }} />
  </View>;
}

export function EmptyState({ icon, title, message }: { icon: IconName; title: string; message?: string }) {
  const c = useAppTheme();
  return <View style={{ alignItems: 'center', paddingVertical: 20 }}>
    <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={30} color={c.ink} /></View>
    <Text style={{ marginTop: 14, color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
    {message ? <Text style={{ marginTop: 4, color: c.text2, fontSize: 14, lineHeight: 20, fontWeight: '500', textAlign: 'center' }}>{message}</Text> : null}
  </View>;
}

export function RadioOptionCard({
  selected,
  onPress,
  title,
  subtitle,
  badge,
  disabled = false,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  disabled?: boolean;
}) {
  const c = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.radioCard,
        {
          backgroundColor: selected ? c.soft : c.card,
          borderColor: selected ? c.accent : 'transparent',
          boxShadow: selected ? c.planSh : c.sh,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <RadioDot selected={selected} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{title}</Text>
        {subtitle ? <Text style={{ color: c.text2, fontSize: 13, fontWeight: '600' }}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={{ backgroundImage: c.grad, paddingHorizontal: 10, height: 24, justifyContent: 'center', borderRadius: 12 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function RadioDot({ selected }: { selected: boolean }) {
  const c = useAppTheme();
  return <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: selected ? c.accent : c.off, backgroundColor: selected ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
    {selected ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3.4} /> : null}
  </View>;
}

export function LoadingScreen() {
  const c = useAppTheme();
  return <View style={[styles.center, { backgroundColor: c.bg }]}><ActivityIndicator color={c.accent} /></View>;
}

export { shadows };

export const ui = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 17 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  panel: { padding: 18, gap: 14 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  gap: { gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 20 },
  headingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { borderRadius: 24, padding: 18 },
  button: { minHeight: 56, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, height: 26, paddingHorizontal: 11, alignSelf: 'flex-start' },
  radioCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, borderRadius: 24, minHeight: 84, borderWidth: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
