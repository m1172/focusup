import { Text } from '../components/Typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../components/Icon';
import { FocusLogo } from '../components/FocusLogo';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme';
import * as Haptics from 'expo-haptics';
import { ActionButton, CircleButton, Note, RadioDot, Screen } from '../components/ui';
import { RestorePurchasesButton } from '../features/subscription/RestorePurchasesButton';
import { trackSubscriptionEvent } from '../services/analytics/localAnalytics';
import { calculateAnnualSavings } from '../services/subscription/subscriptionService';
import { getPlanPackages, presentSubscriptionCustomerCenter } from '../services/subscription/revenueCat';
import type { PaywallSource, PlanId } from '../services/subscription/types';
import { useSubscription } from '../hooks/useSubscription';
import { getConfiguredLegalUrl, SUBSCRIPTION_PRIVACY_URL, SUBSCRIPTION_TERMS_URL } from '../services/subscription/subscriptionConfig';

export default function ProScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const { source: rawSource } = useLocalSearchParams<{ source?: string }>();
  const { offering, isPro, isLoading, purchase, restore, refresh } = useSubscription();
  const packages = useMemo(() => getPlanPackages(offering), [offering]);
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [busy, setBusy] = useState(false);
  const actionLocked = useRef(false);
  const [success, setSuccess] = useState(false);
  const availablePlan = plan && packages[plan] ? plan : packages.annual ? 'annual' : 'monthly';
  const selectedPackage = packages[availablePlan];
  const savings = calculateAnnualSavings(packages.monthly, packages.annual);
  const sources: PaywallSource[] = [
    'settings',
    'instagram_clean_browsing',
    'instagram_explore',
    'instagram_suggested_posts',
    'instagram_recommendations',
    'youtube_home_recommendations',
    'youtube_related_recommendations',
    'youtube_comments',
    'strict_mode',
    'schedules',
    'advanced_statistics',
  ];
  const source = sources.includes(rawSource as PaywallSource) ? (rawSource as PaywallSource) : 'settings';
  const termsUrl = getConfiguredLegalUrl(SUBSCRIPTION_TERMS_URL);
  const privacyUrl = getConfiguredLegalUrl(SUBSCRIPTION_PRIVACY_URL);

  useEffect(() => {
    void trackSubscriptionEvent('paywall_viewed', undefined, source);
  }, [source]);

  const choosePlan = (next: PlanId) => {
    if (!packages[next]) return;
    setPlan(next);
    void Haptics.selectionAsync();
    void trackSubscriptionEvent('plan_selected', next, source);
  };

  const startPurchase = async () => {
    if (!selectedPackage || actionLocked.current) return;
    actionLocked.current = true;
    setBusy(true);
    void trackSubscriptionEvent('purchase_started', availablePlan, source);
    try {
      const result = await purchase(selectedPackage.identifier);
      if (result.status === 'cancelled') {
        void trackSubscriptionEvent('purchase_cancelled', availablePlan, source);
        return;
      }
      if (result.status === 'unavailable') {
        Alert.alert(t('subscription.productUnavailable'), t('subscription.tryAgain'));
        return;
      }
      if (result.status === 'pending') {
        Alert.alert(t('subscription.pendingTitle'), t('subscription.pendingMessage'));
        return;
      }
      setSuccess(true);
      void trackSubscriptionEvent('purchase_completed', availablePlan, source);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      void trackSubscriptionEvent('purchase_failed', availablePlan, source);
      Alert.alert(t('subscription.purchaseFailed'), t('subscription.tryAgain'));
    } finally {
      actionLocked.current = false;
      setBusy(false);
    }
  };

  const restorePurchases = async () => {
    if (actionLocked.current) return;
    actionLocked.current = true;
    setBusy(true);
    void trackSubscriptionEvent('restore_started', undefined, source);
    try {
      const customerInfo = await restore();
      const restored = Boolean(customerInfo.entitlements.active.pro);
      if (restored) {
        void trackSubscriptionEvent('restore_completed', undefined, source);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('subscription.restoreSuccess'), t('subscription.active'));
      } else {
        Alert.alert(t('subscription.restore'), t('subscription.noPurchases'));
      }
    } catch {
      Alert.alert(t('subscription.restore'), t('subscription.tryAgain'));
    } finally {
      actionLocked.current = false;
      setBusy(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'));
  const features = t('ui.proFeatures', { returnObjects: true }) as string[];
  const monthlyPrice = packages.monthly?.product.priceString;
  const annualPrice = packages.annual?.product.priceString;
  const annualPerMonth = packages.annual?.product.pricePerMonthString;
  const plans: { id: PlanId; name: string; sub: string; price: string; best: boolean }[] = [
    { id: 'monthly', name: t('ui.monthly'), sub: t('ui.monthlySub'), price: monthlyPrice ? `${monthlyPrice} / ${t('ui.perMonth')}` : '—', best: false },
    { id: 'annual', name: t('ui.yearly'), sub: annualPerMonth ? t('ui.yearlySub', { price: annualPerMonth }) : savings ? t('subscription.savePercent', { percent: savings }) : t('subscription.annual'), price: annualPrice ? `${annualPrice} / ${t('ui.perYear')}` : '—', best: true },
  ];

  if (success || isPro) return <Screen glow={420} contentStyle={{ flexGrow: 1, justifyContent: 'center', gap: 20 }}>
    <View style={{ alignItems: 'center', gap: 16 }}>
      <FocusLogo size={88} />
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.12, textAlign: 'center' }}>{t(success ? 'subscription.successTitle' : 'subscription.active')}</Text>
      <Text style={{ color: c.text2, fontSize: 16, lineHeight: 24, fontWeight: '500', textAlign: 'center' }}>{t(success ? 'subscription.successMessage' : 'subscription.manageDescription')}</Text>
    </View>
    {isPro ? <ActionButton title={t('subscription.manage')} onPress={() => { void presentSubscriptionCustomerCenter().then(() => refresh()).catch(() => Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions').catch(() => undefined)); }} /> : null}
    <ActionButton title={t('continue')} secondary onPress={close} />
  </Screen>;

  return <Screen glow={420} contentStyle={{ gap: 0 }}>
    <View style={{ height: 66 }}>
      <View style={{ marginTop: 10 }}><FocusLogo size={56} /></View>
      <View style={{ position: 'absolute', right: 0, top: 2 }}><CircleButton label={t('ui.close')} icon="close" iconSize={20} onPress={close} /></View>
    </View>
    <Text accessibilityRole="header" style={{ marginTop: 20, color: c.text, fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -1.26 }}>Vaqtim <Text style={{ color: c.accent, fontWeight: '800' }}>Pro</Text></Text>
    <Text style={{ marginTop: 6, color: c.text2, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>{t('ui.proSubtitle')}</Text>

    <View style={{ marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 14 }}>
      {features.map((feature) => <View key={feature} style={{ width: '46%', flexGrow: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.mintSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={13} color={c.mintInk} strokeWidth={3.2} /></View>
        <Text style={{ flex: 1, color: c.text, fontSize: 14, lineHeight: 19, fontWeight: '700' }}>{feature}</Text>
      </View>)}
    </View>

    {isLoading && !offering ? <ActivityIndicator style={{ marginTop: 12 }} color={c.accent} accessibilityLabel={t('subscription.loading')} /> : null}
    <View accessibilityRole="radiogroup" accessibilityLabel={t('subscription.choosePlan')} style={{ marginTop: 24, gap: 12 }}>
      {plans.map((item) => {
        const available = Boolean(packages[item.id]);
        const selected = available && availablePlan === item.id;
        return <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: !available || busy }} accessibilityLabel={`${item.name}, ${item.price}`} disabled={!available || busy} onPress={() => choosePlan(item.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, height: 84, paddingHorizontal: 18, borderRadius: 24, borderWidth: 2, borderColor: selected ? c.accent : 'transparent', backgroundColor: selected ? c.soft : c.card, boxShadow: selected ? c.planSh : c.sh, opacity: pressed ? 0.85 : 1 })}>
          <RadioDot selected={selected} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.17 }}>{item.name}</Text>
            <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{item.sub}</Text>
          </View>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>{item.price}</Text>
          {item.best ? <View style={{ position: 'absolute', right: 16, top: -12, height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundImage: c.grad, boxShadow: c.sw, justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{t('ui.bestChoice')}</Text></View> : null}
        </Pressable>;
      })}
    </View>

    {!isLoading && !selectedPackage ? <View style={{ marginTop: 16, gap: 10 }}>
      <Note tone="accent" icon="info">{`${t('subscription.unavailableTitle')} ${t('subscription.unavailableMessage')}`}</Note>
      <ActionButton compact variant="secondary" title={t('retry')} onPress={() => void refresh()} disabled={isLoading} />
    </View> : null}

    <ActionButton style={{ marginTop: selectedPackage ? 52 : 24 }} title={busy ? t('subscription.working') : t('ui.startPro')} onPress={() => void startPurchase()} disabled={!selectedPackage || busy || isLoading} />
    <Text style={{ marginTop: 14, color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' }}>{t('ui.cancelAnytime')}</Text>
    <View style={{ marginTop: 10 }}><RestorePurchasesButton onPress={() => void restorePurchases()} disabled={busy || isLoading} /></View>
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>{termsUrl ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(termsUrl); }}><Text style={{ color: c.text2, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>{t('subscription.terms')}</Text></Pressable> : null}{privacyUrl ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(privacyUrl); }}><Text style={{ color: c.text2, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>{t('subscription.privacy')}</Text></Pressable> : null}</View>
  </Screen>;
}
