import { OAuthFlow } from '../oauthFlow';

function setup() {
  let record: string | null = null, now = 1000, generation = 0;
  const storage = { read: jest.fn(async () => record), write: jest.fn(async (value: string) => { record = value; }), remove: jest.fn(async () => { record = null; }) };
  const exchange = jest.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }), accept = jest.fn().mockResolvedValue(undefined);
  const start = jest.fn().mockResolvedValue({ url: 'https://project.supabase.co/auth/v1/authorize', redirectUrl: 'focusup://auth/callback' });
  const flow = new OAuthFlow({ origin: 'https://api.example.com', redirectUrl: 'focusup://auth/callback', storage, createProof: async () => ({ verifier: 'v'.repeat(64), challenge: 'c'.repeat(43) }), start, exchange, accept, generation: () => generation, now: () => now });
  return { flow, storage, exchange, accept, start, advance: () => { now += 11 * 60_000; }, changeAccount: () => { generation++; }, record: () => record };
}

test('only an initiated PKCE flow can accept a callback; duplicate completions exchange once', async () => {
  const { flow, exchange, accept, record } = setup();
  await expect(flow.complete('focusup://auth/callback?code=unrequested')).rejects.toMatchObject({ code: 'INVALID_CALLBACK' });
  await flow.begin('telegram');
  expect(JSON.parse(record()!).verifier).toBe('v'.repeat(64));
  const url = 'focusup://auth/callback?code=single-use-code';
  await Promise.all([flow.complete(url), flow.complete(url + '&state=provider-state')]); await flow.complete(url);
  expect(exchange).toHaveBeenCalledTimes(1); expect(exchange).toHaveBeenCalledWith('single-use-code', 'v'.repeat(64));
  expect(accept).toHaveBeenCalledTimes(1); expect(record()).toBeNull();
});

test('rejects wrong destinations, injected fragments and duplicate code parameters', async () => {
  const { flow, exchange } = setup(); await flow.begin('google');
  for (const url of ['other://auth/callback?code=a', 'focusup://wrong/callback?code=a', 'focusup://auth/callback?code=a#access_token=forged', 'focusup://auth/callback?code=a&code=b']) {
    await expect(flow.complete(url)).rejects.toMatchObject({ code: 'INVALID_CALLBACK' });
  }
  expect(exchange).not.toHaveBeenCalled();
});

test('expired and invalidated attempts cannot switch the account', async () => {
  const expired = setup(); await expired.flow.begin('google'); expired.advance();
  await expect(expired.flow.complete('focusup://auth/callback?code=a')).rejects.toMatchObject({ code: 'INVALID_CALLBACK' });
  const changed = setup(); await changed.flow.begin('apple'); changed.changeAccount();
  await expect(changed.flow.complete('focusup://auth/callback?code=a')).rejects.toMatchObject({ code: 'INVALID_CALLBACK' });
  expect(changed.exchange).not.toHaveBeenCalled();
});

test('fails closed on an unexpected server callback and consumes failed exchanges', async () => {
  const setup1 = setup(); setup1.start.mockResolvedValue({ url: 'https://project.supabase.co/auth/v1/authorize', redirectUrl: 'https://evil.example' });
  await expect(setup1.flow.begin('google')).rejects.toMatchObject({ code: 'INVALID_CALLBACK' });
  expect(setup1.record()).toBeNull();
  const setup2 = setup(); await setup2.flow.begin('google'); setup2.exchange.mockRejectedValue(new Error('network failed after exchange'));
  await expect(setup2.flow.complete('focusup://auth/callback?code=a')).rejects.toThrow();
  expect(setup2.record()).toBeNull();
  await expect(setup2.flow.complete('focusup://auth/callback?code=a')).rejects.toMatchObject({ code: 'INVALID_CALLBACK' });
  expect(setup2.exchange).toHaveBeenCalledTimes(1);
});
