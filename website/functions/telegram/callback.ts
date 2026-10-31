/**
 * Telegram login callback (Cloudflare Pages Function, served at /telegram/callback).
 *
 * Telegram sends sign-ins back to this site, so the domain Telegram shows users is ours instead of the
 * Supabase host. This forwards the request to the Edge API, which checks Telegram's answer and replies
 * with a redirect into the app (focusup://auth/callback?code=… or ?error=…).
 */
type Env = { API_URL?: string };
type Context = { request: Request; env: Env };

// Public API address (the app ships it too). Set API_URL in the Pages project to override.
const DEFAULT_API_URL = 'https://vrmfrhvzvjrktiosptdp.supabase.co/functions/v1/focusup-api';

export async function onRequestGet({ request, env }: Context): Promise<Response> {
  const target = new URL(`${(env.API_URL || DEFAULT_API_URL).replace(/\/+$/, '')}/v1/auth/telegram/callback`);
  target.search = new URL(request.url).search;
  // Forward only the query; never the visitor's cookies or headers.
  const upstream = await fetch(target, { method: 'GET', redirect: 'manual', headers: { Accept: 'text/html' } });
  const location = upstream.headers.get('Location');
  if (upstream.status === 302 && location) {
    return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }
  return new Response('Sign-in could not be completed. Please return to the Vaqtim app and try again.', {
    status: upstream.status >= 400 ? upstream.status : 502,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
