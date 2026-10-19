import { Text } from '../../components/Typography';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../../components/Icon';
import * as Haptics from 'expo-haptics';
import { ActionButton, AlertBanner, BackButton, Note, ProBadge, Screen, Sheet, SheetActions, Toggle } from '../../components/ui';
import { AppIcon } from '../../components/AppIcon';
import { appCatalog } from '../../features/apps/catalog';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import type { SocialAppId } from '../../types/app';
import { isPlatformLocked } from '../../services/strict-mode/strictModeController';
import { useSubscription } from '../../hooks/useSubscription';
import { canUseFeature, type SubscriptionFeature } from '../../services/subscription/subscriptionService';
import type { PaywallSource } from '../../services/subscription/types';
import { NativeAppProtectionCard } from '../../features/protection/NativeAppProtectionCard';

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
  const { appId: raw, returnToBrowser } = useLocalSearchParams<{ appId: string; returnToBrowser?: string }>();
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
  const [enabled, setEnabled] = useState(saved?.enabled ?? false);
  const [filters, setFilters] = useState(saved?.filters ?? {});
  const [dirty, setDirty] = useState(false);
  const [showSavedAlert, setShowSavedAlert] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  const [lockedFeature, setLockedFeature] = useState<{ title: string; source: PaywallSource } | null>(null);
  const visibleEnabled = locked ? true : enabled;

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

  const handleBack = () => {
    if (dirty) {
      Alert.alert(t('save'), t('cancel') + '?', [
        { text: t('cancel'), style: 'cancel' },
        { text: t('back'), onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  const onSave = () => {
    if (locked) { explainLock(); return; }
    setAppEnabled(appId, enabled);
    Object.entries(filters).forEach(([key, value]) => setFilter(appId, key, value));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDirty(false);
    setShowSavedAlert(true);
    saveTimer.current = setTimeout(() => {
      if (returnToBrowser === '1') {
        router.back();
      } else {
        if (router.canGoBack()) router.back(); else router.replace('/(tabs)/apps');
      }
    }, 700);
  };

  const toggleMaster = (value: boolean) => {
    setEnabled(value);
    setDirty(true);

  };

  if (!app?.supported) {
    return (
      <Screen glow={300} glowDarkOnly contentStyle={{ gap: 12 }}>
        <BackButton label={t('back')} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 56 }}><AppIcon appId={appId} size={56} /><Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{app?.name ?? t('apps')}</Text></View>
        <Note tone="accent" icon="info">{t('unavailable')}</Note>
      </Screen>
    );
  }

  const visibleFilters = appId === 'instagram'
    ? ['reels', 'explore', 'recommendations', 'suggestedPosts', 'sponsoredPosts', 'homeFeed']
    : ['shorts', 'recommendations', 'homeRecommendations', 'sponsoredContent', 'comments'];
  return (
    <Screen glow={300} glowDarkOnly contentStyle={{ gap: 12 }} footer={<ActionButton title={t('save')} disabled={locked || showSavedAlert} onPress={onSave} />}>
      <View style={{ height: 44 }}><BackButton label={t('back')} onPress={handleBack} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 56 }}>
        <AppIcon appId={appId} size={56} />
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{app.name}</Text>
      </View>
      <Text style={{ color: c.text2, fontSize: 15, lineHeight: 22, fontWeight: '500' }}>{t(appId === 'instagram' ? 'ui.instagramQuestion' : 'ui.youtubeQuestion')}</Text>
      <NativeAppProtectionCard appId={appId} name={app.name} />

      <AlertBanner visible={showSavedAlert} title={t('design.saved')} message={t('design.savedDetail')} />
      {locked ? <Note tone="amber" icon="lock">{t('strictCannotChange')}</Note> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 64, paddingHorizontal: 18, borderRadius: 24, backgroundColor: c.soft, boxShadow: c.isDark ? '0px 0px 0px 1px rgba(130,119,255,0.22)' : undefined }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}><Icon name="shieldCheck" size={22} color={c.ink} /></View>
        <Text style={{ flex: 1, color: c.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.17 }}>{t('cleanMode')}</Text>
        <Toggle label={t('cleanMode')} value={visibleEnabled} disabled={locked} onDisabledPress={locked ? explainLock : undefined} onChange={toggleMaster} />
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
          const subtitle = locked ? t('strictLockedLabel') : unsupported ? t('ui.unavailableNow') : filter === 'comments' ? t('design.optional') : undefined;
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
              <Toggle
                label={label}
                value={visibleFilter}
                disabled={locked || unsupported || proLocked}
                onDisabledPress={locked ? explainLock : proLocked ? showPro : undefined}
                onChange={(value) => {
                  setFilters((state) => ({ ...state, [filter]: value }));
                  setDirty(true);
                }}
              />
            </Pressable>
          );
        })}
      </View>

      <Note icon="circleCheck">{t(appId === 'instagram' ? 'ui.instagramInfo' : 'ui.youtubeInfo')}</Note>

      <Sheet visible={Boolean(lockedFeature)} onClose={() => setLockedFeature(null)} title={lockedFeature?.title ?? t('subscription.proFeature')} message={t(appId === 'instagram' ? 'browser.cleanModeProDetail' : 'subscription.featureUpsell')}>
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
