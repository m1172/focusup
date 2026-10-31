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
import type { BlockingSwitch, SocialAppId } from '../../types/app';
import { isPlatformLocked } from '../../services/strict-mode/strictModeController';
import { useSubscription } from '../../hooks/useSubscription';
import { canUseFeature, isFeatureAvailable, type SubscriptionFeature } from '../../services/subscription/subscriptionService';
import type { PaywallSource } from '../../services/subscription/types';
import { NativeAppProtectionCard } from '../../features/protection/NativeAppProtectionCard';
import { BlockingSwitches } from '../../features/protection/BlockingSwitches';
import { shortVideoBlockedApps } from '../../services/protection/engine';
import { enableAfterNativeBlock } from '../../features/protection/nativeAppSetup';
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
  const setBlocking = useAppStore((state) => state.setBlocking);
  const nativeBlockOn = useAppStore((state) => shortVideoBlockedApps({ [appId]: state.apps[appId] }).includes(appId));
  const strict = useAppStore((state) => state.strictSession);
  const locked = isPlatformLocked(appId, strict);
  // Changes apply at once: turning on is a 2-second hold, turning off goes through TurnOffSheet.
  const enabled = saved?.enabled ?? false;
  const filters = saved?.filters ?? {};
  const [turnOff, setTurnOff] = useState<{ filter: string | null; blocking?: BlockingSwitch } | null>(null);
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
  const savingsApp = appId === 'instagram' || appId === 'youtube' || appId === 'tiktok' ? appId as SavingsAppId : null;
  const usual = usualMinutes(usualSource, shortFormMinutes, measured?.minutes ?? null);
  const perDay = savingsApp ? appDailySavings(savingsApp, { enabled: visibleEnabled, filters }, usual) : 0;
  const year = yearlyValue(perDay);
  const freeDaysText = formatInteger(year.freeDays, locale);
  const booksText = formatInteger(year.books, locale);
  const shortVideo = savingsApp ? SHORT_VIDEO_FILTER[savingsApp] : null;
  const shortVideoName = appId === 'instagram' ? 'Reels' : appId === 'tiktok' ? 'For You' : 'Shorts';
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
    forYou: 'ui.forYou',
    following: 'ui.following',
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
      : appId === 'tiktok'
      ? {
          forYou: { feature: 'tiktokForYou', source: 'tiktok_feeds' },
          following: { feature: 'tiktokFollowing', source: 'tiktok_feeds' },
          explore: { feature: 'tiktokExplore', source: 'tiktok_feeds' },
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
  // Reels/Shorts blocking starts only after the original app is blocked; other filters turn on directly.
  const blockFirst = (enable: () => void) => {
    if (!savingsApp) { enable(); return; }
    void enableAfterNativeBlock(appId, app.name, shortVideoName, (blocked) => { enable(); setBlocking(appId, 'blockNativeApp', blocked); }).catch(() => Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed')));
  };
  const enableMaster = () => {
    if (locked) { explainLock(); return; }
    const turnOn = () => { setAppEnabled(appId, true); celebrate('master'); };
    if (shortVideo && filters[shortVideo]) blockFirst(turnOn); else turnOn();
  };
  const enableFilter = (filter: string) => {
    if (locked) { explainLock(); return; }
    const turnOn = () => { setFilter(appId, filter, true); celebrate(filter); };
    if (enabled && filter === shortVideo) blockFirst(turnOn); else turnOn();
  };
  const keepOn = (engaged: boolean) => { setTurnOff(null); if (engaged) flash(t('friction.keptTitle'), t('friction.keptBody')); };
  const finishTurnOff = () => {
    if (!turnOff) return;
    if (turnOff.blocking) setBlocking(appId, turnOff.blocking, false);
    else if (turnOff.filter) setFilter(appId, turnOff.filter, false); else setAppEnabled(appId, false);
    setTurnOff(null);
  };
  // What turning something off costs: real minutes only for the short-video filter (or clean mode as a whole).
  const turnOffMinutes = (filter: string | null, blocking?: BlockingSwitch) => blocking ? 0 : filter === null ? perDay : savingsApp && filter === shortVideo && enabled ? usual[savingsApp] : 0;

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
    : appId === 'tiktok' ? ['forYou', 'following', 'explore']
    : ['shorts', 'recommendations', 'homeRecommendations', 'sponsoredContent', 'comments']).filter((filter) => (PRO_ENABLED || filter !== 'sponsoredContent') && (!filterFeatures[filter] || isFeatureAvailable(filterFeatures[filter]!.feature)));
  // Free version: the short-video filter is the only one, so clean mode and that filter are a single control.
  const singleFilter = visibleFilters.length === 1 && visibleFilters[0] === shortVideo;
  const connectedOn = visibleEnabled && (!singleFilter || !shortVideo || locked || Boolean(filters[shortVideo]));
  const enableShortVideo = () => {
    if (locked) { explainLock(); return; }
    blockFirst(() => {
      if (!useAppStore.getState().apps[appId].enabled) setAppEnabled(appId, true);
      if (shortVideo && !useAppStore.getState().apps[appId].filters[shortVideo]) setFilter(appId, shortVideo, true);
      celebrate('master');
    });
  };
  // Free users cannot turn the short-video block off: it is always on, even for apps not added to Vaqtim.
  const feedFixed = Boolean(shortVideo) && !canUseFeature(isPro, 'shortVideoControl');
  const feedAccess = shortVideo ? { feature: 'shortVideoControl' as const, source: filterFeatures[shortVideo]?.source ?? 'instagram_clean_browsing' } : undefined;
  const showFeedPro = () => { if (feedAccess) setLockedFeature({ title: t('ui.blockFeed', { feature: shortVideoName }), source: feedAccess.source }); };
  const sectionLabel = { color: c.text3, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 6, marginTop: 4 } as const;
  return (
    <Screen glow={300} glowDarkOnly contentStyle={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
        <BackButton label={t('back')} />
        <AppIcon appId={appId} size={44} />
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.7 }}>{app.name}</Text>
      </View>
      <Text style={{ color: c.text2, fontSize: 15, lineHeight: 22, fontWeight: '500' }}>{t(appId === 'instagram' ? 'ui.instagramQuestion' : appId === 'tiktok' ? 'ui.tiktokQuestion' : 'ui.youtubeQuestion')}</Text>
      <AlertBanner visible={Boolean(banner)} title={banner?.title ?? ''} message={banner?.message ?? ''} />
      {locked ? <Note tone="amber" icon="lock">{t('strictCannotChange')}</Note> : null}

      {savingsApp ? <View style={{ gap: 16, padding: 18, borderRadius: 28, backgroundColor: c.card, backgroundImage: perDay > 0 ? 'radial-gradient(80% 90% at 100% 0%, rgba(22,185,133,0.16), rgba(22,185,133,0) 70%)' : undefined, boxShadow: c.sh }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundImage: perDay > 0 ? 'linear-gradient(150deg, #4BE3AE 0%, #16B985 55%, #0A8A64 100%)' : undefined, backgroundColor: perDay > 0 ? undefined : c.redSoft, boxShadow: perDay > 0 ? '0px 8px 18px rgba(18,184,134,0.30)' : undefined }}>
            <Icon name={perDay > 0 ? 'sparkles' : 'eyeOff'} size={22} color={perDay > 0 ? '#FFFFFF' : c.red} strokeWidth={2.1} />
          </View>
          <Text style={{ flex: 1, color: c.text2, fontSize: 14, lineHeight: 19, fontWeight: '700' }}>{t('savings.receiptTitle')}</Text>
        </View>
        {perDay > 0 ? <>
          <PoppingValue value={perDay} align="flex-start">
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 }}>
              <Text style={{ color: c.text, fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1.2 }}>{formatDuration(Math.round(perDay), locale)}</Text>
              <Text style={{ color: c.mintInk, fontSize: 16, fontWeight: '800' }}>{t('savings.perDay')}</Text>
            </View>
          </PoppingValue>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([
              { icon: 'clock', value: formatInteger(year.hours, locale), label: t('savings.hoursYear') },
              { icon: 'calendar', value: freeDaysText, label: unitFor(locale, freeDaysText, t('onboarding.freeDayWords', { returnObjects: true }) as string[]) },
              { icon: 'book', value: booksText, label: unitFor(locale, booksText, t('onboarding.bookWords', { returnObjects: true }) as string[]) },
            ] as const).map((tile) => <View key={tile.icon} style={{ flex: 1, gap: 6, padding: 12, borderRadius: 18, backgroundColor: c.card2 }}>
              <Icon name={tile.icon} size={18} color={c.mintInk} strokeWidth={2.2} />
              <View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.text, fontSize: 20, lineHeight: 24, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] }}>{tile.value}</Text>
                <Text numberOfLines={2} style={{ color: c.text3, fontSize: 12, lineHeight: 15, fontWeight: '700' }}>{tile.label}</Text>
              </View>
            </View>)}
          </View>
          <Text style={{ color: c.text3, fontSize: 12, lineHeight: 17, fontWeight: '600' }}>{t('savings.basis', { time: formatDuration(Math.round(usualTotal), locale) })}</Text>
        </> : <Text style={{ color: c.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }}>{t('savings.receiptNone', { feature: shortVideoName })}</Text>}
      </View> : null}

      {/* Free core: one switch. Turning it on asks to block the real app; turning it off goes behind the typing step. */}
      <Text accessibilityRole="header" style={sectionLabel}>{t('ui.scrollBlocking')}</Text>
      <View style={{ padding: 8, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 8, paddingVertical: 8 }}>
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: connectedOn || feedFixed ? c.mintSoft : c.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={appId === 'youtube' ? 'shorts' : 'reels'} size={20} color={connectedOn || feedFixed ? c.mintInk : c.ink} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 16, lineHeight: 20, fontWeight: '700' }}>{t('ui.blockFeed', { feature: shortVideoName })}</Text>
            <Text style={{ color: c.text2, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{locked ? t('strictLockedLabel') : feedFixed ? t('ui.blockFeedAlways') : t('ui.blockFeedHint')}</Text>
          </View>
          {locked ? <Icon name="lock" size={16} color={c.text3} /> : null}
          {feedFixed ? <Pressable accessibilityRole="button" disabled={!isFeatureAvailable('shortVideoControl')} onPress={showFeedPro}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: c.mintSoft }}>
            <Icon name="lock" size={13} color={c.mintInk} strokeWidth={2.4} />
            <Text style={{ color: c.mintInk, fontSize: 13, fontWeight: '800' }}>{t('ui.alwaysOn')}</Text>
          </Pressable> : <View>
            <Toggle label={t('ui.blockFeed', { feature: shortVideoName })} value={connectedOn} disabled={locked} onDisabledPress={explainLock}
              onChange={(next) => { if (next) { if (singleFilter) enableShortVideo(); else enableMaster(); } else setTurnOff({ filter: null }); }} />
            <CelebrationBurst trigger={bursts.master ?? 0} />
          </View>}
        </View>
      </View>

      {savingsApp ? <BlockingSwitches appId={appId} name={app.name} feature={shortVideoName} locked={locked} onLockedPress={explainLock} onRequestTurnOff={(blocking) => setTurnOff({ filter: null, blocking })} /> : null}
      {savingsApp ? <NativeAppProtectionCard appId={appId} name={app.name} feature={shortVideoName} filterOn={nativeBlockOn} /> : null}

      {singleFilter ? null : <>
        <Text accessibilityRole="header" style={sectionLabel}>{t('ui.proSettings')}</Text>
        <View style={{ padding: 8, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
          {visibleFilters.map((filter, index) => {
            const unsupported = filter === 'ads' || filter === 'sponsoredContent';
            const strictBaseline = appId === 'instagram' ? filter === 'reels' : appId === 'tiktok' ? filter === 'forYou' : appId === 'youtube' && filter === 'shorts';
            const access = feedFixed && filter === shortVideo ? feedAccess : filterFeatures[filter];
            const proLocked = Boolean(access && !canUseFeature(isPro, access.feature));
            const visibleFilter = feedFixed && filter === shortVideo ? true : proLocked ? false : locked && (strictBaseline || Boolean(strict?.filters[appId]?.[filter])) ? true : Boolean(filters[filter]);
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
      </>}

      <Note icon="circleCheck">{t(appId === 'instagram' ? 'ui.instagramInfo' : appId === 'tiktok' ? 'ui.tiktokInfo' : 'ui.youtubeInfo')}</Note>

      <TurnOffSheet visible={Boolean(turnOff)} name={turnOff?.blocking === 'blockNativeApp' ? t('browser.blockRealApp', { name: app.name }) : turnOff?.blocking === 'blockWebsite' ? t('browser.blockWebsite') : turnOff?.filter ? t(filterTitles[turnOff.filter] ?? turnOff.filter) : singleFilter ? shortVideoName : t('cleanMode')} minutesPerDay={turnOff ? turnOffMinutes(turnOff.filter, turnOff.blocking) : 0} onKeep={keepOn} onTurnOff={finishTurnOff} />

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
