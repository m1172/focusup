import { accountErrorKey } from '../errors';
import { BackendError } from '../../../services/backend/client';

describe('accountErrorKey', () => {
  it('explains Apple error 1000 instead of a generic failure', () => {
    expect(accountErrorKey({ code: 'ERR_REQUEST_UNKNOWN' })).toBe('cloudAuth.appleAccountMissing');
    expect(accountErrorKey({ code: 'ERR_REQUEST_NOT_HANDLED' })).toBe('cloudAuth.appleAccountMissing');
  });

  it('stays silent when the user cancels the Apple sheet', () => {
    expect(accountErrorKey({ code: 'ERR_REQUEST_CANCELED' })).toBeNull();
  });

  it('keeps backend mappings', () => {
    expect(accountErrorKey(new BackendError(401, 'AUTH_FAILED', 'x'))).toBe('cloudAuth.authFailed');
    expect(accountErrorKey(new Error('boom'))).toBe('cloudAuth.failed');
  });
});
