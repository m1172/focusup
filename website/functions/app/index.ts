/**
 * Smart download link (Cloudflare Pages Function, served at /app and /app/).
 *
 * Phones get a tiny page that opens the store app itself: the App Store app on iPhone and iPad (itms-apps://),
 * the Google Play app on Android (an intent:// link to com.android.vending). If the store app does not open,
 * for example inside an in-app browser that blocks app links, the page falls back to the store's web page.
 * Computers land on the download section of the home page, which has both store buttons. iPads in desktop mode
 * report a Mac user agent, so the computer page checks for a touch screen first.
 */
import { APP_STORE_URL, PLAY_STORE_URL } from '../../src/content/stores';

type Context = { request: Request };
export type Store = 'ios' | 'android';

const PLAY_PACKAGE = new URL(PLAY_STORE_URL).searchParams.get('id') ?? 'com.m1172.focusup';

export function storeFor(userAgent: string): Store | null {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return null;
}

/** Link that opens the store app; `web` is where to go if it does not open. */
export function appLink(store: Store): { app: string; web: string } {
  if (store === 'ios') return { app: APP_STORE_URL.replace(/^https:/, 'itms-apps:'), web: APP_STORE_URL };
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return {
    app: `intent://details?id=${PLAY_PACKAGE}#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=${fallback};end`,
    web: PLAY_STORE_URL,
  };
}

const page = (script: string, links: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vaqtim</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.png">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#F7F7FC;color:#55536B;text-align:center}a{display:inline-block;color:#fff;background:#5B4FE9;border-radius:14px;padding:14px 22px;margin:6px;font-weight:700;text-decoration:none}</style>
</head><body><p>${links}</p><script>${script}</script></body></html>`;

const html = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'User-Agent' } });

export async function onRequestGet({ request }: Context): Promise<Response> {
  const store = storeFor(request.headers.get('User-Agent') ?? '');
  if (store) {
    const { app, web } = appLink(store);
    // Try the store app; if this page is still visible a moment later, open the store's web page instead.
    const script = `(function(){var web=${JSON.stringify(web)},left=false;document.addEventListener('visibilitychange',function(){if(document.hidden)left=true;});window.addEventListener('pagehide',function(){left=true;});setTimeout(function(){location.href=${JSON.stringify(app)};},50);setTimeout(function(){if(!left)location.replace(web);},1800);})();`;
    return html(page(script, `<a href="${app}">${store === 'ios' ? 'Open in App Store' : 'Open in Google Play'}</a>`));
  }
  const ios = appLink('ios');
  const script = `(function(){
  if (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) { location.href = ${JSON.stringify(ios.app)}; setTimeout(function(){ if (!document.hidden) location.replace(${JSON.stringify(ios.web)}); }, 1500); return; }
  var langs = (navigator.languages || [navigator.language || '']).map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
  var pick = 'uz';
  for (var i = 0; i < langs.length; i++) { if (langs[i] === 'uz' || langs[i] === 'ru' || langs[i] === 'en') { pick = langs[i]; break; } }
  location.replace('/' + pick + '/#download');
})();`;
  return html(page(script, `<a href="${APP_STORE_URL}">App Store</a><a href="${PLAY_STORE_URL}">Google Play</a>`));
}
