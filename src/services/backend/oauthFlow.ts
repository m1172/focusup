import { BackendError } from './client';
import type { AuthSession, OAuthProvider } from './types';
import type { SecretStorage } from './sessionManager';

type Pending = { origin: string; verifier: string; redirectUrl: string; createdAt: number; generation: number };
export class OAuthFlow {
  private completion: { url: string; promise: Promise<void> } | null = null;
  private completed: { url: string; at: number } | null = null;
  constructor(private options: {
    origin: string; redirectUrl: string; storage: SecretStorage;
    createProof: () => Promise<{ verifier: string; challenge: string }>;
    start: (provider: OAuthProvider, challenge: string) => Promise<{ url: string; redirectUrl: string }>;
    exchange: (code: string, verifier: string) => Promise<AuthSession>;
    accept: (session: AuthSession, generation: number) => Promise<void>;
    generation: () => number; now?: () => number;
  }) {}
  private now() { return this.options.now?.() ?? Date.now(); }
  async begin(provider: OAuthProvider): Promise<string> {
    const generation = this.options.generation();
    const proof = await this.options.createProof();
    const start = await this.options.start(provider, proof.challenge);
    if (start.redirectUrl !== this.options.redirectUrl || generation !== this.options.generation()) throw new BackendError(400, 'INVALID_CALLBACK', 'Unexpected sign-in callback.');
    const authUrl = new URL(start.url);
    if (authUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(authUrl.hostname)) throw new BackendError(400, 'INVALID_CALLBACK', 'Invalid sign-in URL.');
    await this.options.storage.write(JSON.stringify({ origin: this.options.origin, verifier: proof.verifier, redirectUrl: start.redirectUrl, createdAt: this.now(), generation } satisfies Pending));
    this.completed = null;
    return start.url;
  }
  complete(url: string): Promise<void> {
    let key: string;
    try {
      const target = new URL(url), expected = new URL(this.options.redirectUrl);
      if (target.protocol !== expected.protocol || target.host !== expected.host || target.pathname !== expected.pathname || target.hash || target.username || target.password || target.searchParams.getAll('code').length > 1) throw new Error('Invalid destination');
      expected.search = new URLSearchParams({ code: target.searchParams.get('code') ?? '', error: target.searchParams.get('error') ?? '' }).toString();
      key = expected.toString();
    } catch { return Promise.reject(new BackendError(400, 'INVALID_CALLBACK', 'Unexpected sign-in callback.')); }
    if (this.completion?.url === key) return this.completion.promise;
    if (this.completed?.url === key && this.now() - this.completed.at < 60_000) return Promise.resolve();
    const promise = this.finish(url, key);
    this.completion = { url: key, promise };
    void promise.finally(() => { if (this.completion?.promise === promise) this.completion = null; }).catch(() => undefined);
    return promise;
  }
  private async finish(url: string, key: string) {
    const target = new URL(url), expected = new URL(this.options.redirectUrl);
    if (target.protocol !== expected.protocol || target.host !== expected.host || target.pathname !== expected.pathname || target.hash || target.username || target.password) throw new BackendError(400, 'INVALID_CALLBACK', 'Unexpected sign-in callback.');
    const raw = await this.options.storage.read();
    let pending: Pending | null = null;
    try { pending = raw ? JSON.parse(raw) as Pending : null; } catch { /* Reject corrupt attempts. */ }
    if (!pending || pending.origin !== this.options.origin || pending.redirectUrl !== this.options.redirectUrl || typeof pending.verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(pending.verifier) || !Number.isFinite(pending.createdAt) || this.now() < pending.createdAt || this.now() - pending.createdAt > 10 * 60_000 || pending.generation !== this.options.generation()) throw new BackendError(400, 'INVALID_CALLBACK', 'Start a new sign-in attempt.');
    if (target.searchParams.has('error')) { await this.cancel(); throw new BackendError(400, 'AUTH_CANCELLED', 'Sign-in was cancelled.'); }
    const codes = target.searchParams.getAll('code');
    if (codes.length !== 1 || !codes[0] || codes[0].length > 4096) throw new BackendError(400, 'INVALID_CALLBACK', 'A sign-in code is required.');
    // Consume before exchange. A network failure requires a fresh provider attempt,
    // avoiding replay of a code that might already have been redeemed upstream.
    await this.options.storage.remove();
    const session = await this.options.exchange(codes[0], pending.verifier);
    await this.options.accept(session, pending.generation);
    this.completed = { url: key, at: this.now() };
  }
  async cancel() { this.completed = null; await this.options.storage.remove(); }
}
