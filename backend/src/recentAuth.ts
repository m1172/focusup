import { authenticatedAt, FRESH_AUTH_SECONDS } from './family.ts';
import { ApiError } from './errors.ts';
export function requireFreshAuthentication(token: string, now = Date.now()) {
  const timestamp = authenticatedAt(token);
  if (!timestamp || timestamp > now / 1000 + 60 || now / 1000 - timestamp > FRESH_AUTH_SECONDS) throw new ApiError(403, 'REAUTH_REQUIRED', 'Sign in again to confirm this change.');
}
