import { BackendError } from '../../services/backend/client';

export function accountErrorKey(error: unknown): string | null {
  const code = error instanceof BackendError ? error.code : error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'AUTH_CANCELLED' || code === 'ERR_REQUEST_CANCELED' || code === 'SESSION_CHANGED') return null;
  if (code === 'NOT_CONFIGURED' || code === 'PROVIDER_UNAVAILABLE') return 'cloudAuth.unavailable';
  if (code === 'STORAGE_UNAVAILABLE') return 'cloudAuth.storageError';
  if (code === 'REVISION_CONFLICT') return 'cloudAuth.conflict';
  if (code === 'STRICT_ACTIVE') return 'cloudAuth.strictBlocked';
  if (code === 'INVALID_BACKUP') return 'cloudAuth.invalidBackup';
  if (code === 'RESTORE_FAILED') return 'cloudAuth.restoreFailed';
  if (code === 'INVALID_CALLBACK') return 'cloudAuth.callbackFailed';
  if (error instanceof BackendError && error.status === 429) return 'cloudAuth.rateLimited';
  if (error instanceof BackendError && error.status === 401) return 'cloudAuth.authFailed';
  if (code === 'NETWORK_ERROR' || error instanceof BackendError && error.status === 503) return 'cloudAuth.networkError';
  return 'cloudAuth.failed';
}
