import { PRO_ENABLED } from '../../config/release';
import { Text } from '../../components/Typography';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../../components/Icon';
import { AlertBanner, BackButton, Note, ProBadge, Screen, Sheet, SheetActions, Toggle } from '../../components/ui';
import { AppIcon } from '../../components/AppIcon';
import { appCatalog } from '../../features/apps/catalog';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import type { SocialAppId } from '../../types/app';
import { isPlatformLocked } from '../../services/strict-mode/strictModeController';
import { useSubscription } from '../../hooks/useSubscription';
import { canUseFeature, isFeatureAvailable, type SubscriptionFeature } from '../../services/subscription/subscriptionService';
import type { PaywallSource } from '../../services/subscription/types';
import { NativeAppProtectionCard } from '../../features/protection/NativeAppProtectionCard';
import { CelebrationBurst, HoldToEnable, TurnOffSheet } from '../../features/protection/FrictionControls';
import { useOnboardingStore } from '../../store/onboardingStore';
import { appDailySavings, SHORT_VIDEO_FILTER, usualMinutes, yearlyValue, type SavingsAppId } from '../../features/savings/savings';
import { formatInteger, unitFor } from '../../features/onboarding/dayBudget';
import { formatDuration } from '../../utils/formatDuration';
import { PoppingValue } from '../../features/onboarding/components';

const filterIcons: Record<string, IconName> = {
  reels: 'reels',
  explore: 'explore',
  recommendations: 'layers',
  suggestedPosts: 'plusSquare',
  sponsoredPosts: 'megaphone',
  sponsoredContent: 'megaphone',
  ads: 'megaphone',
  shorts: 'shorts',
  homeRecommendations: 'home',
  comments: 'comment',
  homeFeed: 'feed',
};

export default function AppSettingsScreen() {
  const { appId: raw } = useLocalSearchParams<{ appId: string; returnToBrowser?: string }>();
  const appId = raw as SocialAppId;
  const app = appCatalog[appId];
  const { t } = useTranslation();
  const c = useAppTheme();
  const isPro = useSubscription().isPro;
  const saved = useAppStore((state) => state.apps[appId]);
  const setAppEnabled = useAppStore((state) => state.setAppEnabled);
  const setFilter = useAppStore((state) => state.setFilter);
  const strict = useAppStore((state) => state.strictSession);
  const locked = isPlatformLocked(appId, strict);
  // Changes apply at once: turning on is a 2-second hold, turning off goes through TurnOffSheet.
  const enabled = saved?.enabled ?? false;
  const filters = saved?.filters ?? {};
  const [turnOff, setTurnOff] = useState<{ filter: string | null } | null>(null);
  const [banner, setBanner] = useState<{ title: string; message: string } | null>(null);
  // One counter per control ('master' or a filter key); bumping it plays the celebration burst there.
  const [bursts, setBursts] = useState<Record<string, number>>({});
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  const [lockedFeature, setLockedFeature] = useState<{ title: string; source: PaywallSource } | null>(null);
  const visibleEnabled = locked ? true : enabled;
  const locale = useAppStore((state) => state.selectedLanguage);
  const usualSource = useOnboardingStore((state) => state.source);
  const shortFormMinutes = useOnboardingStore((state) => state.shortFormMinutes);
  const measured = useOnboardingStore((state) => state.measured);
  const savingsApp = appId === 'instagram' || appId === 'youtube' ? appId as SavingsAppId : null;
  const usual = usualMinutes(usualSource, shortFormMinutes, measured?.minutes ?? null);
  const perDay = savingsApp ? appDailySavings(savingsApp, { enabled: visibleEnabled, filters }, usual) : 0;
  const year = yearlyValue(perDay);
  const freeDaysText = formatInteger(year.freeDays, locale);
  const freeDays = `${freeDaysText} ${unitFor(locale, freeDaysText, t('onboarding.freeDayWords', { returnObjects: true }) as string[])}`;
  const shortVideo = savingsApp ? SHORT_VIDEO_FILTER[savingsApp] : null;
  const shortVideoName = appId === 'instagram' ? 'Reels' : 'Shorts';
  // What the user told us (or Android measured) for Reels, Shorts and TikTok together.
  const usualTotal = usualSource === 'measured' && measured ? Object.values(measured.minutes).reduce((sum, value) => sum + (value ?? 0), 0) : shortFormMinutes;

  const explainLock = () => Alert.alert(t('strictActive'), t('strictCannotChange'));
  const filterTitles: Record<string, string> = {
    homeFeed: 'ui.homeFeed',
    reels: 'reels',
    explore: 'explore',
    recommendations: 'recommendations',
    suggestedPosts: 'suggestedPosts',
    sponsoredPosts: 'ads',
    sponsoredContent: 'ads',
    ads: 'ads',
    shorts: 'shorts',
    homeRecommendations: 'homeRecommendations',
    comments: 'comments',
  };
  const filterFeatures: Partial<Record<string, { feature: SubscriptionFeature; source: PaywallSource }>> =
    appId === 'instagram'
      ? {
          homeFeed: { feature: 'instagramHomeFeed', source: 'instagram_recommendations' },
          reels: { feature: 'instagramReels', source: 'instagram_clean_browsing' },
          sponsoredPosts: { feature: 'instagramCleanBrowsing', source: 'instagram_clean_browsing' },
          explore: { feature: 'instagramExplore', source: 'instagram_explore' },
          recommendations: { feature: 'instagramRecommendations', source: 'instagram_recommendations' },
          suggestedPosts: { feature: 'instagramSuggestedPosts', source: 'instagram_suggested_posts' },
        }
      : {
          shorts: { feature: 'youtubeShorts', source: 'youtube_related_recommendations' },
          homeRecommendations: { feature: 'youtubeHomeRecommendations', source: 'youtube_home_recommendations' },
          recommendations: { feature: 'youtubeRelatedRecommendations', source: 'youtube_related_recommendations' },
          comments: { feature: 'youtubeComments', source: 'youtube_comments' },
        };

  const flash = (title: string, message: string) => {
    setBanner({ title, message });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setBanner(null), 1800);
  };
  const celebrate = (key: string) => { setBursts((state) => ({ ...state, [key]: (state[key] ?? 0) + 1 })); flash(t('friction.turnedOn'), t('design.savedDetail')); };
  const enableMaster = () => { if (locked) { explainLock(); return; } setAppEnabled(appId, true); celebrate('master'); };
  const enableFilter = (filter: string) => { if (locked) { explainLock(); return; } setFilter(appId, filter, true); celebrate(filter); };
  const keepOn = (engaged: boolean) => { setTurnOff(null); if (engaged) flash(t('friction.keptTitle'), t('friction.keptBody')); };
  const finishTurnOff = () => {
    if (!turnOff) return;
    if (turnOff.filter) setFilter(appId, turnOff.filter, false); else setAppEnabled(appId, false);
    setTurnOff(null);
  };
  // What turning something off costs: real minutes only for the short-video filter (or clean mode as a whole).
  const turnOffMinutes = (filter: string | null) => filter === null ? perDay : savingsApp && filter === shortVideo && enabled ? usual[savingsApp] : 0;

  if (!app?.supported) {
    return (
      <Screen glow={300} glowDarkOnly contentStyle={{ gap: 12 }}>
        <BackButton label={t('back')} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 56 }}><AppIcon appId={appId} size={56} /><Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{app?.name ?? t('apps')}</Text></View>
        <Note tone="accent" icon="info">{t('unavailable')}</Note>
      </Screen>
    );
  }

  const visibleFilters = (appId === 'instagram'
    ? ['reels', 'explore', 'recommendations', 'suggestedPosts', 'sponsoredPosts', 'homeFeed']
    : ['shorts', 'recommendations', 'homeRecommendations', 'sponsoredContent', 'comments']).filter((filter) => (PRO_ENABLED || filter !== 'sponsoredContent') && (!filterFeatures[filter] || isFeatureAvailable(filterFeatures[filter]!.feature)));
  return (
    <Screen glow={300} glowDarkOnly contentStyle={{ gap: 12 }}>
      <View style={{ height: 44 }}><BackButton label={t('back')} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 56 }}>
        <AppIcon appId={appId} size={56} />
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{app.name}</Text>
      </View>
      <Text style={{ color: c.text2, fontSize: 15, lineHeight: 22, fontWeight: '500' }}>{t(appId === 'instagram' ? 'ui.instagramQuestion' : 'ui.youtubeQuestion')}</Text>
      {isFeatureAvailable('nativeProtection') ? <NativeAppProtectionCard appId={appId} name={app.name} /> : null}

      <AlertBanner visible={Boolean(banner)} title={banner?.title ?? ''} message={banner?.message ?? ''} />
      {locked ? <Note tone="amber" icon="lock">{t('strictCannotChange')}</Note> : null}

      {savingsApp ? <View style={{ padding: 18, borderRadius: 24, backgroundImage: perDay > 0 ? c.hero : undefined, backgroundColor: perDay > 0 ? undefined : c.card, boxShadow: perDay > 0 ? c.heroSh : c.sh, gap: 4 }}>
        <Text style={{ color: perDay > 0 ? c.onHero : c.text2, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{t('savings.receiptTitle')}</Text>
        {perDay > 0 ? <>
          <PoppingValue value={perDay} align="flex-start">
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.4 }}>{formatDuration(Math.round(perDay), locale)}</Text>
              <Text style={{ color: c.onHero, fontSize: 16, fontWeight: '700' }}>{t('savings.perDay')}</Text>
            </View>
          </PoppingValue>
          <Text style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 21, fontWeight: '800' }}>{t('savings.receiptYear', { hours: formatInteger(year.hours, locale), days: freeDays })}</Text>
          <Text style={{ marginTop: 4, color: c.onHero, fontSize: 12, lineHeight: 17, fontWeight: '600' }}>{t('savings.basis', { time: formatDuration(Math.round(usualTotal), locale) })}</Text>
        </> : <Text style={{ color: c.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }}>{t('savings.receiptNone', { feature: shortVideoName })}</Text>}
      </View> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 64, paddingHorizontal: 18, borderRadius: 24, backgroundColor: c.soft, boxShadow: c.isDark ? '0px 0px 0px 1px rgba(130,119,255,0.22)' : undefined }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}><Icon name="shieldCheck" size={22} color={c.ink} /></View>
        <Text style={{ flex: 1, color: c.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.17 }}>{t('cleanMode')}</Text>
        <View>{visibleEnabled ? <Toggle label={t('cleanMode')} value disabled={locked} onDisabledPress={locked ? explainLock : undefined} onChange={() => setTurnOff({ filter: null })} /> : <HoldToEnable label={t('cleanMode')} onEnabled={enableMaster} />}<CelebrationBurst trigger={bursts.master ?? 0} /></View>
      </View>

      <View style={{ padding: 8, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
        {visibleFilters.map((filter, index) => {
          const unsupported = filter === 'ads' || filter === 'sponsoredContent';
          const strictBaseline = appId === 'instagram' ? filter === 'reels' : appId === 'youtube' && filter === 'shorts';
          const access = filterFeatures[filter];
          const proLocked = Boolean(access && !canUseFeature(isPro, access.feature));
          const visibleFilter = proLocked ? false : locked && (strictBaseline || Boolean(strict?.filters[appId]?.[filter])) ? true : Boolean(filters[filter]);
          const showPro = () => {
            if (access) setLockedFeature({ title: t(filterTitles[filter] ?? filter), source: access.source });
          };
          const label = t(filterTitles[filter] ?? filter);
          const valueSubtitle = savingsApp && filter === shortVideo ? t('savings.filterValue', { time: formatDuration(Math.round(usual[savingsApp]), locale) }) : t('savings.fewerDistractions');
          const subtitle = locked ? t('strictLockedLabel') : unsupported ? t('ui.unavailableNow') : filter === 'comments' ? t('design.optional') : valueSubtitle;
          return (
            <Pressable
              key={filter}
              disabled={!(locked || proLocked)}
              onPress={locked ? explainLock : proLocked ? showPro : undefined}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: index === 0 ? 52 : 53, paddingHorizontal: 8, paddingVertical: subtitle ? 6 : 0, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.line }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={filterIcons[filter] ?? 'sparkle'} size={20} color={c.ink} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flexShrink: 1, color: c.text, fontSize: 16, lineHeight: 20, fontWeight: '700' }}>{label}</Text>
                  {proLocked ? <ProBadge /> : null}
                </View>
                {subtitle ? <Text style={{ color: c.text2, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{subtitle}</Text> : null}
              </View>
              <View>
                {visibleFilter || locked || unsupported || proLocked
                  ? <Toggle label={label} value={visibleFilter} disabled={locked || unsupported || proLocked} onDisabledPress={locked ? explainLock : proLocked ? showPro : undefined} onChange={() => setTurnOff({ filter })} />
                  : <HoldToEnable label={label} onEnabled={() => enableFilter(filter)} />}
                <CelebrationBurst trigger={bursts[filter] ?? 0} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Note icon="circleCheck">{t(appId === 'instagram' ? 'ui.instagramInfo' : 'ui.youtubeInfo')}</Note>

      <TurnOffSheet visible={Boolean(turnOff)} name={turnOff?.filter ? t(filterTitles[turnOff.filter] ?? turnOff.filter) : t('cleanMode')} minutesPerDay={turnOff ? turnOffMinutes(turnOff.filter) : 0} onKeep={keepOn} onTurnOff={finishTurnOff} />

      <Sheet visible={PRO_ENABLED && Boolean(lockedFeature)} onClose={() => setLockedFeature(null)} title={lockedFeature?.title ?? t('subscription.proFeature')} message={t(appId === 'instagram' ? 'browser.cleanModeProDetail' : 'subscription.featureUpsell')}>
        <SheetActions
          cancel={t('subscription.notNow')}
          confirm={t('subscription.viewPro')}
          onCancel={() => setLockedFeature(null)}
          onConfirm={() => {
            const source = lockedFeature?.source ?? 'settings';
            setLockedFeature(null);
            router.push({ pathname: '/pro', params: { source } });
          }}
        />
      </Sheet>
    </Screen>
  );
}
