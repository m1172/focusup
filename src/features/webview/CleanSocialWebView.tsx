import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ComponentType, RefAttributes } from 'react';
import { Linking, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation, type WebViewProps } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import type { SocialAppId } from '../../types/app';
import type { SocialWebViewConfig, SocialWebViewEvent, YouTubeBlockerConfig } from '../../types/social';
import { isBlockedInstagramNavigation, isInstagramAuthenticationUrl } from '../../services/blockers/instagram';
import { generateInstagramBlockingScript } from '../../services/blockers/instagram/index';
import { generateBlockingScript } from '../../services/blockers';
import { createYouTubeBlockingScript, isBlockedYouTubeNavigation, YOUTUBE_BASE_URL } from '../../services/blockers/youtube';
import { parseSocialWebViewEvent } from '../../services/social-browser/messages';
import { classifySocialBrowserNavigation, isSameDocumentLocation, normalizeSocialBrowserLink } from '../../services/social-browser/navigation';
import { useAppTheme } from '../../theme';
import { WebViewErrorState } from './WebViewErrorState';
import { WebViewLoadingState } from './WebViewLoadingState';
import { useRemoteBlockerConfigStore } from '../../store/remoteBlockerConfigStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { canUseFeature } from '../../services/subscription/subscriptionService';
import { createBrowserViewportScript } from '../../services/social-browser/viewport';

const platformSites: Record<string, { url: string; hosts: string[]; name: string }> = {
  instagram: { url: 'https://www.instagram.com/', hosts: ['instagram.com'], name: 'Instagram' },
  youtube: { url: YOUTUBE_BASE_URL, hosts: ['youtube.com', 'youtu.be'], name: 'YouTube' },
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
};

const allowedHost = (hostname: string, domains: string[]) => domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
type WebViewHandle = { goBack: () => void; goForward: () => void; reload: () => void; injectJavaScript: (script: string) => void };
const NativeWebView = WebView as ComponentType<WebViewProps & RefAttributes<WebViewHandle>>;
export type CleanSocialWebViewHandle = WebViewHandle & { navigate: (url: string) => void };

export const CleanSocialWebView = forwardRef<CleanSocialWebViewHandle, CleanSocialWebViewProps>(function CleanSocialWebView({ platform, blockerConfig, enabled, initialUrl, fullScreen = false, onNavigationChange, onEvent, onExternalNavigation, onSettings, onPageReadyChange }, forwardedRef) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebViewHandle>(null);
  const currentDocumentUrl = useRef(platformSites[platform]?.url ?? '');
  const hasLoadedSuccessfully = useRef(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0.04);
  const [error, setError] = useState(false);
  const [pageBackground, setPageBackground] = useState(c.background);
  const [isStory, setIsStory] = useState(false);
  const site = platformSites[platform];
  const [initialRequest] = useState(() => {
    const url = normalizeSocialBrowserLink(platform, initialUrl ?? '') ?? site?.url;
    const reelsBlocked = platform === 'instagram' && enabled && isBlockedInstagramNavigation(url ?? '', { reels: blockerConfig.reels });
    const shortsBlocked = platform === 'youtube' && enabled && isBlockedYouTubeNavigation(url ?? '', blockerConfig as Partial<YouTubeBlockerConfig>);
    return { url: reelsBlocked || shortsBlocked ? site?.url : url, reelsBlocked, shortsBlocked };
  });
  const source = useMemo(() => ({ uri: initialRequest.url }), [initialRequest.url]);
  const initialBlockReported = useRef(false);
  const remoteRule = useRemoteBlockerConfigStore((state) => platform === 'instagram' || platform === 'youtube' ? state.config.platforms[platform] : undefined);
  const pro = useSubscriptionStore((state) => state.isPro);
  const lastInjectedScript = useRef('');

  useEffect(() => {
    if (initialBlockReported.current) return;
    initialBlockReported.current = true;
    if (initialRequest.reelsBlocked) onEvent?.({ type: 'BLOCKED_NAVIGATION', platform: 'instagram', feature: 'reels' });
    if (initialRequest.shortsBlocked) onEvent?.({ type: 'BLOCKED_NAVIGATION', platform: 'youtube', feature: 'shorts' });
  }, [initialRequest, onEvent]);
  const blockerScript = useMemo(() => {
    if (platform === 'instagram') return generateInstagramBlockingScript(blockerConfig, enabled, remoteRule, canUseFeature(pro, 'instagramCleanBrowsing'));
    if (platform === 'youtube') return createYouTubeBlockingScript(blockerConfig as Partial<YouTubeBlockerConfig>, enabled, remoteRule);
    return generateBlockingScript(platform, enabled, blockerConfig) ?? '';
  }, [platform, enabled, blockerConfig, remoteRule, pro]);
  const script = useMemo(() => createBrowserViewportScript(fullScreen, insets, platform) + '\n' + blockerScript,
    [blockerScript, fullScreen, insets, platform]);

  useEffect(() => {
    if (!loading && lastInjectedScript.current !== script && script) {
      webRef.current?.injectJavaScript(script);
      lastInjectedScript.current = script;
    }
  }, [loading, script]);

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
  }));

  if (!site) return null;
  return (
    <SafeAreaView edges={fullScreen ? (isStory ? ['left', 'right'] : ['top', 'left', 'right']) : ['bottom']} style={{ flex: 1, backgroundColor: fullScreen ? pageBackground : c.background }}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
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
          onLoadStart={(event) => { currentDocumentUrl.current = event.nativeEvent.url || currentDocumentUrl.current; setLoading(true); setProgress(0.04); setError(false); }}
          onLoadProgress={(event) => setProgress(event.nativeEvent.progress)}
          onLoad={() => { hasLoadedSuccessfully.current = true; setProgress(1); setError(false); onPageReadyChange?.(true); }}
          onLoadEnd={() => { setLoading(false); }}
          onNavigationStateChange={(value) => { currentDocumentUrl.current = value.url; onNavigationChange?.(value); }}
          onShouldStartLoadWithRequest={(request) => shouldStartNavigation(request.url, request.isTopFrame !== false)}
          onError={() => { setLoading(false); setError(true); onPageReadyChange?.(false); }}
          onHttpError={(event) => { if (event.nativeEvent.statusCode >= 500 && isSameDocumentLocation(event.nativeEvent.url, currentDocumentUrl.current)) { setLoading(false); setError(true); onPageReadyChange?.(false); } }}
          onContentProcessDidTerminate={() => { setLoading(false); setError(true); onPageReadyChange?.(false); }}
          onRenderProcessGone={() => { setLoading(false); setError(true); onPageReadyChange?.(false); }}
          style={{ flex: 1 }}
        />
        {loading && !error ? <WebViewLoadingState progress={progress} label={platform === 'instagram' ? t('instagramLoading') : t('socialLoading', { name: site.name })} /> : null}
        {error ? <WebViewErrorState title={platform === 'instagram' ? t('instagramError') : t('socialError', { name: site.name })} description={platform === 'instagram' ? t('instagramErrorDesc') : t('socialErrorDesc')} onRetry={() => { setError(false); setLoading(true); setProgress(0.04); webRef.current?.reload(); }} onSettings={onSettings} /> : null}
      </View>
    </SafeAreaView>
  );
});

export type { WebViewNavigation };
