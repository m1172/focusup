import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Typography';
import { FocusLogo } from '../components/FocusLogo';
import { Icon } from '../components/Icon';
import { ActionButton, CircleButton, Note, RadioDot, Screen } from '../components/ui';
import { FAMILY_ENABLED } from '../config/release';
import { RestorePurchasesButton } from '../features/subscription/RestorePurchasesButton';
import { useSubscription } from '../hooks/useSubscription';
import { useAppTheme } from '../theme';
import { getPlanPackages } from '../services/subscription/revenueCat';
import { manageSubscriptionUrl } from '../services/subscription/manage';
import { calculateAnnualSavings } from '../services/subscription/subscriptionService';
import { getConfiguredLegalUrl, SUBSCRIPTION_PRIVACY_URL, SUBSCRIPTION_TERMS_URL } from '../services/subscription/subscriptionConfig';
import { normalizeSubscriptionError, type PaidTier, type PlanId } from '../services/subscription/types';

export default function ProScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const { tier: initialTier } = useLocalSearchParams<{ tier?: string }>();
  const { status, offerings, isLoading, error, pending, purchase, restore, refresh } = useSubscription();
  const [tier, setTier] = useState<PaidTier>(initialTier === 'family' ? 'family' : 'pro');
  const [plan, setPlan] = useState<PlanId>('annual');
  const tiers: PaidTier[] = FAMILY_ENABLED ? ['pro', 'family'] : ['pro'];
  const selectedTier = FAMILY_ENABLED ? tier : 'pro';
  const packages = getPlanPackages(offerings[selectedTier]);
  const period = packages[plan] ? plan : plan === 'annual' ? 'monthly' : 'annual';
  const selected = packages[period];
  const savings = calculateAnnualSavings(packages.monthly, packages.annual);
  const terms = getConfiguredLegalUrl(SUBSCRIPTION_TERMS_URL);
  const privacy = getConfiguredLegalUrl(SUBSCRIPTION_PRIVACY_URL);
  const otherStore = Boolean(status?.store && status.store !== Platform.OS);
  const manageUrl = manageSubscriptionUrl(status, Platform.OS);
  const tierName = t(`billing.${selectedTier}`);
  const sameProduct = Boolean(selected && status?.productId === selected.product.identifier);

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => { void refresh(); }, 15_000);
    return () => clearInterval(timer);
  }, [pending, refresh]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'));
  const open = (url: string) => { void Linking.openURL(url).catch(() => Alert.alert(t('subscription.tryAgain'))); };
  const run = async (restorePurchase: boolean) => {
    try {
      const result = restorePurchase ? await restore() : await purchase(selectedTier, period);
      if (result === 'active') Alert.alert(t(restorePurchase ? 'subscription.restoreSuccess' : 'billing.active'));
      if (result === 'scheduled') Alert.alert(t('billing.changeSubmitted'));
      if (result === 'unavailable') Alert.alert(t(restorePurchase ? 'subscription.noPurchases' : 'subscription.productUnavailable'));
    } catch (failure) {
      Alert.alert(t(normalizeSubscriptionError(failure) === 'ownership' ? 'billing.ownership' : 'subscription.purchaseFailed'));
    }
  };

  return <Screen contentStyle={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <FocusLogo size={56} />
      <CircleButton label={t('ui.close')} icon="close" iconSize={20} onPress={close} />
    </View>
    <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, fontWeight: '900' }}>{tierName}</Text>

    {tiers.length > 1 ? <View accessibilityRole="radiogroup" accessibilityLabel={t('subscription.choosePlan')} style={{ flexDirection: 'row', gap: 8 }}>
      {tiers.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: item === selectedTier, disabled: isLoading }} disabled={isLoading}
        onPress={() => setTier(item)} style={{ flex: 1, gap: 8, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: c.card }}>
        <RadioDot selected={item === selectedTier} />
        <Text style={{ color: c.text, flexShrink: 1, fontWeight: '700' }}>{t(`billing.${item}`)}</Text>
      </Pressable>)}
    </View> : null}

    {status && status.tier !== 'free' ? <>
      <Note tone="accent" icon="info">{t('billing.current', { tier: t(`billing.${status.tier}`) })}</Note>
      {manageUrl ? <ActionButton secondary title={t('subscription.manage')} onPress={() => open(manageUrl)} />
        : otherStore ? <Note tone="amber" icon="info">{t('billing.otherStore')}</Note> : null}
    </> : null}

    {/* The stores ask the paywall to say what the price buys, and that the app works without paying. */}
    <View style={{ gap: 10, padding: 16, borderRadius: 20, backgroundColor: c.card }}>
      <Text accessibilityRole="header" style={{ color: c.text2, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }}>{t('billing.includesTitle')}</Text>
      {(t(`billing.${selectedTier}Includes`, { returnObjects: true }) as string[]).map((point) => <View key={point} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="circleCheck" size={20} color={c.mint} strokeWidth={2.2} />
        <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{point}</Text>
      </View>)}
    </View>
    <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>{t('billing.freeNote')}</Text>

    {isLoading && !selected ? <ActivityIndicator color={c.accent} accessibilityLabel={t('subscription.loading')} /> : null}
    <View accessibilityRole="radiogroup" accessibilityLabel={t('subscription.choosePlan')} style={{ gap: 8 }}>
      {(['monthly', 'annual'] as const).map((option) => {
        const pkg = packages[option];
        if (!pkg) return null;
        return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: option === period, disabled: isLoading }} disabled={isLoading} onPress={() => setPlan(option)}
          style={{ minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, padding: 14, borderRadius: 20, borderWidth: 2, borderColor: option === period ? c.accent : 'transparent' }}>
          <RadioDot selected={option === period} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>{pkg.product.priceString} / {t(option === 'annual' ? 'ui.perYear' : 'ui.perMonth')}</Text>
            {option === 'annual' && savings ? <Text style={{ color: c.text2 }}>{t('subscription.savePercent', { percent: savings })}</Text> : null}
          </View>
        </Pressable>;
      })}
    </View>
    {pending ? <Note tone="accent" icon="info">{t('billing.activating')}</Note> : null}
    {!isLoading && (error || !status || !terms || !privacy || !selected) && !pending ? <Note tone="accent" icon="info">{t('subscription.unavailableTitle')}</Note> : null}
    {pending || error || !status || !selected ? <ActionButton compact secondary title={t('retry')} disabled={isLoading} onPress={() => void refresh()} /> : null}

    <ActionButton title={t(isLoading ? 'subscription.working' : sameProduct ? 'billing.active' : 'billing.subscribe')} onPress={() => void run(false)}
      disabled={!FAMILY_ENABLED || !selected || !status || !terms || !privacy || isLoading || Boolean(error || pending) || otherStore || sameProduct} />
    {/* Name, full price and period of the chosen plan, then how renewal and cancelling work in this phone's store. */}
    <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20 }}>
      {selected ? `${t(period === 'annual' ? 'billing.billedAnnual' : 'billing.billedMonthly', { name: tierName, price: selected.product.priceString })}. ` : ''}
      {t(Platform.OS === 'ios' ? 'billing.renewIos' : 'billing.renewAndroid')}
    </Text>
    <RestorePurchasesButton onPress={() => void run(true)} disabled={isLoading || !status} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {terms ? <Text accessibilityRole="link" onPress={() => open(terms)} style={{ color: c.accent }}>{t('subscription.terms')}</Text> : null}
      {privacy ? <Text accessibilityRole="link" onPress={() => open(privacy)} style={{ color: c.accent }}>{t('subscription.privacy')}</Text> : null}
    </View>
  </Screen>;
}
