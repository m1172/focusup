import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, AppState, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeIn, FadeInDown, ZoomIn, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { Icon } from '../../components/Icon';
import { ActionButton, Card, Note, Screen } from '../../components/ui';
import { AnswerChips, CountUp, OnboardingHeader, PoppingValue, RulerPicker, StepTitle } from '../../features/onboarding/components';
import { FREE_HOURS, MINUTE_ANSWERS, ONBOARDING_APPS, answerFor, splitDay, unitFor, type OnboardingAppId } from '../../features/onboarding/dayBudget';
import { appCatalog } from '../../features/apps/catalog';
import { androidUsage, type MeasuredUsage } from '../../services/device-usage/androidUsage';
import { useAppStore } from '../../store/appStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme';
import { formatDuration } from '../../utils/formatDuration';

const SHORT_FORM_MAX = 600;
const shortFormLabels: Record<OnboardingAppId, string> = { instagram: 'Reels', youtube: 'Shorts', tiktok: 'TikTok' };

/**
 * Step 1. Android reads real per-app time (Usage access); iOS can't share usage numbers with apps,
 * so it — or an Android user who skips the permission — answers one short-video question.
 */
export default function YourTimeScreen() {
  const [manual, setManual] = useState(!androidUsage.supported);
  return manual ? <EstimateStep /> : <MeasureStep onManual={() => { useOnboardingStore.getState().chooseEstimate(); setManual(true); }} />;
}

/** iOS: "How much time a day do you spend watching Reels, Shorts and TikToks?" */
function EstimateStep() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const minutes = useOnboardingStore((s) => s.shortFormMinutes);
  const setMinutes = useOnboardingStore((s) => s.setShortFormMinutes);
  const freeShare = Math.round(splitDay(minutes).freeShare * 100);
  const label = formatDuration(minutes, locale);
  const current = answerFor(minutes, MINUTE_ANSWERS);
  const options = MINUTE_ANSWERS.map((a, k) => ({
    key: String(k),
    value: a.pick,
    selected: k === current,
    label: k === 0 ? t('onboarding.rangeUnder', { time: formatDuration(a.to, locale) })
      : a.to === Infinity ? t('onboarding.rangeOver', { time: formatDuration(a.from, locale) })
        : `${formatDuration(a.from, locale)}–${formatDuration(a.to, locale)}`,
  }));
  return <Screen glow={300} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('continue')} arrow onPress={() => { setMinutes(minutes); router.push('/onboarding/reveal'); }} />}>
    <OnboardingHeader step={1} />
    <View style={{ marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {ONBOARDING_APPS.map((id, i) => <Animated.View key={id} entering={reducedMotion ? undefined : ZoomIn.delay(60 + i * 90).springify().damping(13)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, height: 34, paddingLeft: 4, paddingRight: 12, borderRadius: 17, backgroundColor: c.apps[id].bg }}>
        <AppIcon appId={id} size={26} />
        <Text style={{ color: c.apps[id].ink, fontSize: 14, fontWeight: '800' }}>{shortFormLabels[id]}</Text>
      </Animated.View>)}
    </View>
    <View style={{ marginTop: 16 }}><StepTitle title={t('onboarding.estimateTitle')} body={t('onboarding.estimateBody')} /></View>
    <View style={{ marginTop: 22 }}><AnswerChips options={options} onSelect={setMinutes} delay={180} /></View>
    <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(450).duration(600).easing(Easing.out(Easing.cubic))} style={{ marginTop: 26, alignItems: 'center' }}>
      <PoppingValue value={minutes}>
        <Text style={{ color: c.text, fontSize: 56, lineHeight: 64, fontWeight: '800', letterSpacing: -2.5, fontVariant: ['tabular-nums'] }}>{label}</Text>
      </PoppingValue>
      <View style={{ marginTop: 10, minHeight: 34, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 17, backgroundColor: c.redSoft }}>
        <Text style={{ color: c.red, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.dailyLive', { percent: freeShare, hours: FREE_HOURS })}</Text>
      </View>
      <View style={{ marginTop: 18, alignSelf: 'stretch' }}>
        <RulerPicker
          min={15}
          max={SHORT_FORM_MAX}
          step={15}
          value={minutes}
          onChange={setMinutes}
          isMajor={(v) => v % 60 === 0}
          majorLabel={(v) => formatDuration(v, locale)}
          accessibilityLabel={t('onboarding.estimateTitle')}
          accessibilityValue={label}
        />
      </View>
      <Text style={{ marginTop: 2, color: c.text3, fontSize: 12, fontWeight: '700' }}>{t('onboarding.fineTune')}</Text>
    </Animated.View>
  </Screen>;
}

type MeasureState = { kind: 'checking' } | { kind: 'intro' } | { kind: 'loading' } | { kind: 'ready'; usage: MeasuredUsage };

/** Android: asks for Usage access, then shows the real daily averages. */
function MeasureStep({ onManual }: { onManual: () => void }) {
  const { t } = useTranslation();
  const [state, setState] = useState<MeasureState>({ kind: 'checking' });
  const asked = useRef(false);
  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const usage = await androidUsage.read(7);
    if (!usage) { setState({ kind: 'intro' }); return; }
    useOnboardingStore.getState().setMeasured(usage);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setState({ kind: 'ready', usage });
  }, []);
  useEffect(() => {
    let alive = true;
    void androidUsage.hasAccess().then((granted) => { if (!alive) return; if (granted) void load(); else setState({ kind: 'intro' }); });
    // Coming back from Settings: read as soon as access is on.
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !asked.current) return;
      void androidUsage.hasAccess().then((granted) => { if (alive && granted) { asked.current = false; void load(); } });
    });
    return () => { alive = false; sub.remove(); };
  }, [load]);
  const footer = state.kind === 'ready'
    ? <ActionButton title={t('continue')} arrow onPress={() => router.push('/onboarding/reveal')} />
    : <View style={{ gap: 6 }}>
      <ActionButton title={t('onboarding.allowUsage')} icon={<Icon name="lock" size={19} color="#FFFFFF" strokeWidth={2.2} />} disabled={state.kind !== 'intro'} onPress={() => { asked.current = true; void androidUsage.openSettings(); }} />
      <ActionButton ghost title={t('onboarding.enterManually')} onPress={onManual} />
    </View>;
  return <Screen glow={320} contentStyle={{ gap: 0 }} footer={footer}>
    <OnboardingHeader step={1} />
    {state.kind === 'ready' ? <MeasuredResult usage={state.usage} /> : <MeasureIntro loading={state.kind !== 'intro'} />}
  </Screen>;
}

function MeasureIntro({ loading }: { loading: boolean }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reducedMotion]);
  const shimmer = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.45 }));
  return <View>
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.measureTitle')} body={t('onboarding.measureBody')} /></View>
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(220).duration(550).easing(Easing.out(Easing.cubic))} style={{ marginTop: 24 }}>
      <Card style={{ gap: 16 }}>
        {ONBOARDING_APPS.map((id, i) => <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppIcon appId={id} size={40} />
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{appCatalog[id].name}</Text>
            <Animated.View style={[{ height: 8, width: `${[78, 56, 66][i]}%`, borderRadius: 4, backgroundColor: c.apps[id].ink }, shimmer]} />
          </View>
          <Animated.View style={[{ width: 46, height: 12, borderRadius: 6, backgroundColor: c.off }, shimmer]} />
        </View>)}
        {loading ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}><ActivityIndicator color={c.accent} /><Text style={{ color: c.text2, fontSize: 14, fontWeight: '700' }}>{t('onboarding.measuring')}</Text></View> : null}
      </Card>
    </Animated.View>
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(380).duration(550)} style={{ marginTop: 14 }}>
      <Note tone="accent" icon="shieldCheck">{t('onboarding.measureHint')}</Note>
    </Animated.View>
  </View>;
}

function MeasuredResult({ usage }: { usage: MeasuredUsage }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const total = ONBOARDING_APPS.reduce((sum, id) => sum + usage.minutes[id], 0);
  const max = Math.max(1, ...ONBOARDING_APPS.map((id) => usage.minutes[id]));
  const days = `${usage.days} ${unitFor(locale, String(usage.days), t('onboarding.dayWords', { returnObjects: true }) as string[])}`;
  return <View>
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.measuredTitle')} body={t('onboarding.measuredBody', { days })} /></View>
    <Animated.View entering={reducedMotion ? undefined : ZoomIn.delay(120).duration(500).easing(Easing.out(Easing.back(1.4)))} style={{ marginTop: 26, alignItems: 'center' }}>
      <CountUp to={total} delay={200} duration={1400} format={(v) => formatDuration(Math.round(v), locale)} style={{ color: c.text, fontSize: 60, lineHeight: 68, fontWeight: '800', letterSpacing: -2.5 }} />
      <Text style={{ color: c.text2, fontSize: 15, fontWeight: '700' }}>{t('onboarding.measuredTotal')} · {t('onboarding.perDay', { time: formatDuration(total, locale) })}</Text>
    </Animated.View>
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(300).duration(550)} style={{ marginTop: 22 }}>
      <Card style={{ gap: 16 }}>
        {ONBOARDING_APPS.map((id, i) => <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: usage.minutes[id] > 0 ? 1 : 0.55 }}>
          <AppIcon appId={id} size={40} dimmed={usage.minutes[id] === 0} />
          <View style={{ flex: 1, gap: 7 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{appCatalog[id].name}</Text>
              <CountUp to={usage.minutes[id]} delay={400 + i * 150} duration={1100} format={(v) => formatDuration(Math.round(v), locale)} style={{ color: c.apps[id].ink, fontSize: 15, fontWeight: '800' }} />
            </View>
            <GrowBar share={usage.minutes[id] / max} color={c.apps[id].ink} delay={400 + i * 150} />
          </View>
        </View>)}
      </Card>
    </Animated.View>
    {total < 15 ? <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(900)} style={{ marginTop: 14 }}><Note tone="mint" icon="sparkles">{t('onboarding.measuredNone')}</Note></Animated.View> : null}
  </View>;
}

function GrowBar({ share, color, delay }: { share: number; color: string; delay: number }) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const width = useSharedValue(reducedMotion ? share : 0);
  useEffect(() => {
    if (!reducedMotion) width.value = withDelay(delay, withTiming(share, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [delay, reducedMotion, share, width]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0.03, width.value) * 100}%` }));
  return <View style={{ height: 8, borderRadius: 4, backgroundColor: c.card2, overflow: 'hidden' }}>
    <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: color }, fill]} />
  </View>;
}
