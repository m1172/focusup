import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireFreshAuthentication } from '../src/recentAuth.ts';
const token = (timestamp: number) => `header.${Buffer.from(JSON.stringify({ amr: [{ timestamp }], iat: 10000 })).toString('base64url')}.signature`;
test('recent authentication uses the verified authentication time, never token refresh time', () => {
  assert.doesNotThrow(() => requireFreshAuthentication(token(9500), 10000000));
  assert.throws(() => requireFreshAuthentication(token(9000), 10000000), { code: 'REAUTH_REQUIRED' });
  assert.throws(() => requireFreshAuthentication(token(11000), 10000000), { code: 'REAUTH_REQUIRED' });
  assert.throws(() => requireFreshAuthentication('invalid', 10000000), { code: 'REAUTH_REQUIRED' });
});
