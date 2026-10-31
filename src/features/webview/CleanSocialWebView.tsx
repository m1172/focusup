import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ComponentType, RefAttributes } from 'react';
import { Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation, type WebViewProps } from 'react-native-webview';
import { PostHogMaskView } from 'posthog-react-native';
import { captureProductEvent } from '../../services/analytics/productAnalytics';
import { useTranslation } from 'react-i18next';
import type { SocialAppId } from '../../types/app';
import type { SocialWebViewConfig, SocialWebViewEvent, TikTokBlockerConfig, YouTubeBlockerConfig } from '../../types/social';
import { isBlockedInstagramNavigation, isInstagramAuthenticationUrl } from '../../services/blockers/instagram';
import { generateInstagramBlockingScript } from '../../services/blockers/instagram/index';
import { generateBlockingScript } from '../../services/blockers';
import { createYouTubeBlockingScript, isBlockedYouTubeNavigation, YOUTUBE_BASE_URL } from '../../services/blockers/youtube';
import { isBlockedTikTokNavigation, tiktokFeedFeature, TIKTOK_BASE_URL } from '../../services/blockers/tiktok';
import { parseSocialWebViewEvent } from '../../services/social-browser/messages';
import { classifySocialBrowserNavigation, isSameDocumentLocation, normalizeSocialBrowserLink } from '../../services/social-browser/navigation';
import { useAppTheme } from '../../theme';
import { WebViewErrorState } from './WebViewErrorState';
import { WebViewLoadingState } from './WebViewLoadingState';
import { useRemoteBlockerConfigStore } from '../../store/remoteBlockerConfigStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { canUseFeature } from '../../services/subscription/subscriptionService';
import { createBrowserViewportScript } from '../../services/social-browser/viewport';
import { createAppPromoScript } from '../../services/social-browser/appPromo';
import { createPageIdleScript } from '../../services/social-browser/pageIdle';
import { msSinceLastTap, perfLogsEnabled } from '../../services/performance/tapTiming';

const platformSites: Record<string, { url: string; hosts: string[]; name: string }> = {
  instagram: { url: 'https://www.instagram.com/', hosts: ['instagram.com'], name: 'Instagram' },
  youtube: { url: YOUTUBE_BASE_URL, hosts: ['youtube.com', 'youtu.be'], name: 'YouTube' },
  tiktok: { url: TIKTOK_BASE_URL, hosts: ['tiktok.com'], name: 'TikTok' },
};

type CleanSocialWebViewProps = {
  platform: SocialAppId;
  blockerConfig: SocialWebViewConfig;
  enabled: boolean;
  initialUrl?: string;
  fullScreen?: boolean;
  onNavigationChange?: (navigation: WebViewNavigation) => void;
  onEvent?: (event: SocialWebViewEvent) => void;
  onExternalNavigation?: (url: string) => boolean;
  onSettings?: () => void;
  onPageReadyChange?: (ready: boolean) => void;
  /** False while the page is kept alive off screen; media is paused when it goes false. */
  active?: boolean;
  /** Replaces the error state when the web process dies, e.g. so a hidden page can be dropped instead. */
  onContentProcessGone?: () => void;
};

const allowedHost = (hostname: string, domains: string[]) => domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
/** Posted once per document when the first frame is on screen; carries no page data. */
const PAGE_READY_MESSAGE = 'focusup:page-ready';
/** Grayscale (Pro): one style element, added or removed so the page itself is untouched. */
const grayscaleScript = (on: boolean) => `(function () {
  var id = 'focusup-grayscale'; var style = document.getElementById(id);
  if (!${on}) { if (style) style.remove(); return; }
  if (!style) { style = document.createElement('style'); style.id = id; (document.head || document.documentElement).appendChild(style); }
  style.textContent = 'html { filter: grayscale(1) !important; }';
})();`;
const PAGE_READY_SCRIPT = `(function () {
  if (window.__focusupReadyPosted) return; window.__focusupReadyPosted = true;
  var sent = false;
  var post = function () { if (sent) return; sent = true; requestAnimationFrame(function () { try { window.ReactNativeWebView.postMessage('${PAGE_READY_MESSAGE}'); } catch (e) {} }); };
  // First contentful paint arrives long before load on script-heavy pages; DOMContentLoaded is the fallback.
  try { new PerformanceObserver(function (list) { if (list.getEntriesByName('first-contentful-paint').length) post(); }).observe({ type: 'paint', buffered: true }); } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', post, { once: true }); else post();
})();`;

type WebViewHandle = { goBack: () => void; goForward: () => void; reload: () => void; injectJavaScript: (script: string) => void };
const NativeWebView = WebView as ComponentType<WebViewProps & RefAttributes<WebViewHandle>>;
export type CleanSocialWebViewHandle = WebViewHandle & {
  navigate: (url: string) => void;
  /** Leave a kept page that the current blockers no longer allow (settings changed while it was hidden). */
  revalidate: () => void;
};

export const CleanSocialWebView = forwardRef<CleanSocialWebViewHandle, CleanSocialWebViewProps>(function CleanSocialWebView({ platform, blockerConfig, enabled, initialUrl, fullScreen = false, onNavigationChange, onEvent, onExternalNavigation, onSettings, onPageReadyChange, active = true, onContentProcessGone }, forwardedRef) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebViewHandle>(null);
  const currentDocumentUrl = useRef(platformSites[platform]?.url ?? '');
  const hasLoadedSuccessfully = useRef(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0.04);
  const [error, setError] = useState(false);
  /** The page has drawn its first frame: show it instead of waiting for every image and script (onLoadEnd). */
  const [painted, setPainted] = useState(false);
  const [pageBackground, setPageBackground] = useState(c.background);
  const [isStory, setIsStory] = useState(false);
  const site = platformSites[platform];
  const [initialRequest] = useState(() => {
    const url = normalizeSocialBrowserLink(platform, initialUrl ?? '') ?? site?.url;
    const reelsBlocked = platform === 'instagram' && enabled && isBlockedInstagramNavigation(url ?? '', { reels: blockerConfig.reels });
    const shortsBlocked = platform === 'youtube' && enabled && isBlockedYouTubeNavigation(url ?? '', blockerConfig as Partial<YouTubeBlockerConfig>);
    const tiktokBlocked = platform === 'tiktok' && enabled && isBlockedTikTokNavigation(url ?? '', blockerConfig as Partial<TikTokBlockerConfig>) ? tiktokFeedFeature(url ?? '') : null;
    return { url: reelsBlocked || shortsBlocked || tiktokBlocked ? site?.url : url, reelsBlocked, shortsBlocked, tiktokBlocked };
  });
  const source = useMemo(() => ({ uri: initialRequest.url }), [initialRequest.url]);
  const initialBlockReported = useRef(false);
  const remoteRule = useRemoteBlockerConfigStore((state) => platform === 'instagram' || platform === 'youtube' ? state.config.platforms[platform] : undefined);
  const pro = useSubscriptionStore((state) => state.isPro);
  const grayscale = useWellbeingStore((state) => state.grayscale) && canUseFeature(pro, 'grayscale');
  const lastInjectedScript = useRef('');
  // Load timing (development or EXPO_PUBLIC_PERF_LOGS builds): when the page first shows content vs. when every resource finished.
  const [openedAt] = useState(() => Date.now());
  const loggedVisible = useRef(false);
  const timing = (step: string) => { if (perfLogsEnabled) console.log(`[browser:${platform}] ${step} after ${Date.now() - openedAt} ms (${msSinceLastTap()} ms after the tap)`); };

  useEffect(() => {
    if (initialBlockReported.current) return;
    initialBlockReported.current = true;
    if (initialRequest.reelsBlocked) onEvent?.({ type: 'BLOCKED_NAVIGATION', platform: 'instagram', feature: 'reels' });
    if (initialRequest.shortsBlocked) onEvent?.({ type: 'BLOCKED_NAVIGATION', platform: 'youtube', feature: 'shorts' });
    if (initialRequest.tiktokBlocked) onEvent?.({ type: 'BLOCKED_NAVIGATION', platform: 'tiktok', feature: initialRequest.tiktokBlocked });
  }, [initialRequest, onEvent]);
  const blockerScript = useMemo(() => {
    if (platform === 'instagram') return generateInstagramBlockingScript(blockerConfig, enabled, remoteRule, canUseFeature(pro, 'instagramCleanBrowsing'));
    if (platform === 'youtube') return createYouTubeBlockingScript(blockerConfig as Partial<YouTubeBlockerConfig>, enabled, remoteRule);
    return generateBlockingScript(platform, enabled, blockerConfig) ?? '';
  }, [platform, enabled, blockerConfig, remoteRule, pro]);
  const script = useMemo(() => PAGE_READY_SCRIPT + '\n' + createBrowserViewportScript(fullScreen, insets, platform) + '\n' + createAppPromoScript() + '\n' + grayscaleScript(grayscale) + '\n' + blockerScript,
    [blockerScript, fullScreen, insets, platform, grayscale]);

  useEffect(() => {
    if (!loading && lastInjectedScript.current !== script && script) {
      webRef.current?.injectJavaScript(script);
      lastInjectedScript.current = script;
    }
  }, [loading, script]);

  const wasHidden = useRef(false);
  const latestScript = useRef(script);
  useEffect(() => { latestScript.current = script; }, [script]);
  useEffect(() => {
    // Only a page that was hidden needs waking up; a fresh, visible page has nothing to restore.
    if (active && !wasHidden.current) return;
    wasHidden.current = !active;
    // Hiding disconnects the page watchers; running the scripts again on show reconnects them and catches up.
    webRef.current?.injectJavaScript(createPageIdleScript(!active) + (active ? '\n' + latestScript.current : ''));
  }, [active]);

  useEffect(() => {
    if (!loading || error) return undefined;
    const timeout = setTimeout(() => { setLoading(false); setError(true); if (!hasLoadedSuccessfully.current) onPageReadyChange?.(false); }, 30_000);
    return () => clearTimeout(timeout);
  }, [loading, error, onPageReadyChange]);

  const shouldStartNavigation = (url: string, isTopFrame = true) => {
    try {
      const target = classifySocialBrowserNavigation(platform, url, isTopFrame);
      if (target === 'reject') return false;
      if (!isTopFrame) return target === 'internal';
      const parsed = new URL(url);
      const remoteBlocked = site && allowedHost(parsed.hostname, site.hosts) && remoteRule?.routes?.some((route) => parsed.pathname === route || parsed.pathname.startsWith(route.endsWith('/') ? route : route + '/'));
      if (platform === 'youtube' && enabled && (isBlockedYouTubeNavigation(url, blockerConfig as Partial<YouTubeBlockerConfig>) || (blockerConfig.shorts && remoteBlocked))) {
        onEvent?.({ type: 'BLOCKED_NAVIGATION', platform: 'youtube', feature: 'shorts' });
        return false;
      }
      const tiktokFeature = platform === 'tiktok' && enabled && isBlockedTikTokNavigation(url, blockerConfig as Partial<TikTokBlockerConfig>) ? tiktokFeedFeature(url) : null;
      if (tiktokFeature) {
        onEvent?.({ type: 'BLOCKED_NAVIGATION', platform: 'tiktok', feature: tiktokFeature });
        return false;
      }
      const currentInstagramAuthPage = platform === 'instagram' && isInstagramAuthenticationUrl(currentDocumentUrl.current);
      if (platform === 'instagram' && !currentInstagramAuthPage && enabled && isBlockedInstagramNavigation(url, { reels: blockerConfig.reels })) {
        onEvent?.({ type: 'BLOCKED_NAVIGATION', platform: 'instagram', feature: 'reels' });
        return false;
      }
      if (target === 'internal') return true;
      if (onExternalNavigation?.(url)) return false;
      void Linking.openURL(url).catch(() => undefined);
    } catch { /* Reject malformed URLs. */ }
    return false;
  };

  const receiveMessage = (raw: string) => {
    if (raw === PAGE_READY_MESSAGE) { if (!painted) { timing('first frame (loading screen hidden)'); setPainted(true); } return; }
    const message = parseSocialWebViewEvent(raw, platform);
    if (message?.type === 'PAGE_APPEARANCE') { setPageBackground(message.backgroundColor); setIsStory(message.isStory); return; }
    if (message) onEvent?.(message);
  };

  useImperativeHandle(forwardedRef, () => ({
    goBack: () => webRef.current?.goBack(),
    goForward: () => webRef.current?.goForward(),
    reload: () => webRef.current?.reload(),
    injectJavaScript: (value) => webRef.current?.injectJavaScript(value),
    navigate: (value) => {
      const url = normalizeSocialBrowserLink(platform, value);
      if (url && shouldStartNavigation(url)) webRef.current?.injectJavaScript(`window.location.assign(${JSON.stringify(url)}); true;`);
    },
    revalidate: () => {
      const url = currentDocumentUrl.current;
      if (!hasLoadedSuccessfully.current || !site || !enabled || !url) return;
      const blocked = platform === 'youtube' ? isBlockedYouTubeNavigation(url, blockerConfig as Partial<YouTubeBlockerConfig>)
        : platform === 'tiktok' ? isBlockedTikTokNavigation(url, blockerConfig as Partial<TikTokBlockerConfig>)
        : platform === 'instagram' && !isInstagramAuthenticationUrl(url) && isBlockedInstagramNavigation(url, { reels: blockerConfig.reels });
      if (blocked) webRef.current?.injectJavaScript(`window.location.replace(${JSON.stringify(site.url)}); true;`);
    },
  }));

  if (!site) return null;
  return (
    <SafeAreaView edges={fullScreen ? (isStory ? ['left', 'right'] : ['top', 'left', 'right']) : ['bottom']} style={{ flex: 1, backgroundColor: fullScreen ? pageBackground : c.background }}>
      <PostHogMaskView style={{ flex: 1, backgroundColor: c.background }}>
        <NativeWebView
          ref={webRef}
          source={source}
          originWhitelist={['https://*', 'http://*']}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          allowsPictureInPictureMediaPlayback
          mediaCapturePermissionGrantType="prompt"
          allowsBackForwardNavigationGestures
          hideKeyboardAccessoryView
          keyboardDisplayRequiresUserAction
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          contentInsetAdjustmentBehavior="never"
          autoManageStatusBarEnabled={false}
          injectedJavaScriptBeforeContentLoaded={script}
          injectedJavaScript={script}
          onMessage={(event) => receiveMessage(event.nativeEvent.data)}
          onLoadStart={(event) => { currentDocumentUrl.current = event.nativeEvent.url || currentDocumentUrl.current; setLoading(true); setPainted(false); setProgress(0.04); setError(false); }}
          onLoadProgress={(event) => { setProgress(event.nativeEvent.progress); if (!loggedVisible.current && event.nativeEvent.progress >= 0.5) { loggedVisible.current = true; timing('progress 50%'); } }}
          onLoad={() => { timing('onLoad'); hasLoadedSuccessfully.current = true; setProgress(1); setError(false); onPageReadyChange?.(true); }}
          onLoadEnd={() => { timing('onLoadEnd'); setLoading(false); }}
          onNavigationStateChange={(value) => { currentDocumentUrl.current = value.url; onNavigationChange?.(value); }}
          onShouldStartLoadWithRequest={(request) => shouldStartNavigation(request.url, request.isTopFrame !== false)}
          onError={() => { captureProductEvent('browser_failed', { social_platform: platform, failure_code: 'LOAD_ERROR' }); setLoading(false); setError(true); onPageReadyChange?.(false); }}
          onHttpError={(event) => { if (event.nativeEvent.statusCode >= 500 && isSameDocumentLocation(event.nativeEvent.url, currentDocumentUrl.current)) { setLoading(false); setError(true); onPageReadyChange?.(false); } }}
          onContentProcessDidTerminate={() => { if (onContentProcessGone) { onContentProcessGone(); return; } setLoading(false); setError(true); onPageReadyChange?.(false); }}
          onRenderProcessGone={() => { if (onContentProcessGone) { onContentProcessGone(); return; } setLoading(false); setError(true); onPageReadyChange?.(false); }}
          style={{ flex: 1 }}
        />
        {loading && !painted && !error ? <WebViewLoadingState progress={progress} label={platform === 'instagram' ? t('instagramLoading') : t('socialLoading', { name: site.name })} /> : null}
        {error ? <WebViewErrorState title={platform === 'instagram' ? t('instagramError') : t('socialError', { name: site.name })} description={platform === 'instagram' ? t('instagramErrorDesc') : t('socialErrorDesc')} onRetry={() => { setError(false); setLoading(true); setProgress(0.04); webRef.current?.reload(); }} onSettings={onSettings} /> : null}
      </PostHogMaskView>
    </SafeAreaView>
  );
});

export type { WebViewNavigation };
