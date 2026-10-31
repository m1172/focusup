/**
 * Smart download link (Cloudflare Pages Function, served at /app and /app/).
 *
 * iPhone and iPad go to the App Store, Android phones go to Google Play. Anything else gets a tiny page that
 * checks once more in the browser (iPads in desktop mode report a Mac user agent) and otherwise opens the
 * download section of the home page, which has both store buttons.
 */
import { APP_STORE_URL, PLAY_STORE_URL } from '../../src/content/stores';

type Context = { request: Request };

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store', Vary: 'User-Agent' } });

export function storeFor(userAgent: string): 'ios' | 'android' | null {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return null;
}

export async function onRequestGet({ request }: Context): Promise<Response> {
  const store = storeFor(request.headers.get('User-Agent') ?? '');
  if (store === 'ios') return redirect(APP_STORE_URL);
  if (store === 'android') return redirect(PLAY_STORE_URL);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vaqtim</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.png">
<script>
(function () {
  var touchMac = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  if (touchMac) { location.replace(${JSON.stringify(APP_STORE_URL)}); return; }
  var langs = (navigator.languages || [navigator.language || '']).map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
  var pick = 'uz';
  for (var i = 0; i < langs.length; i++) { if (langs[i] === 'uz' || langs[i] === 'ru' || langs[i] === 'en') { pick = langs[i]; break; } }
  location.replace('/' + pick + '/#download');
})();
</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#F7F7FC}a{color:#5B4FE9;margin:0 10px;font-weight:700}</style>
</head><body><p><a href="${APP_STORE_URL}">App Store</a><a href="${PLAY_STORE_URL}">Google Play</a></p></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'User-Agent' } });
}
