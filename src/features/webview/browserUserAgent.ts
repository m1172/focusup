import { Platform } from 'react-native';
import type { SocialAppId } from '../../types/app';
import { protectionBridge } from '../../services/protection/nativeBridge';

/**
 * Android's web view tells websites it is an in-app web view ("; wv" and "Version/4.0" in its user agent).
 * Instagram then treats it as an embedded browser and sends some pages, such as Messages, to its app,
 * so tapping Messages did nothing. This is the same browser with the plain Chrome user agent.
 */
export function chromeUserAgent(webViewUserAgent: string): string {
  return webViewUserAgent.replace(/; wv\)/, ')').replace(/ Version\/\d+(?:\.\d+)*/, '');
}

let cached: string | null = null;

/** Reads the web view's user agent once at startup (Android only). */
export async function loadBrowserUserAgent(): Promise<void> {
  if (Platform.OS !== 'android' || cached !== null) return;
  const userAgent = await protectionBridge.getWebViewUserAgent();
  // Only a real browser user agent; anything else keeps the web view's own (older builds return '').
  cached = /AppleWebKit\/.+Chrome\//.test(userAgent) ? chromeUserAgent(userAgent) : '';
}

/**
 * The user agent for a platform's page, or undefined for the web view's own.
 * Instagram only: Google does not allow web views to present themselves as a browser for its sign-in (YouTube).
 */
export function browserUserAgent(platform: SocialAppId): string | undefined {
  return Platform.OS === 'android' && platform === 'instagram' && cached ? cached : undefined;
}
