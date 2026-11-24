import { blockingIssue, makerName } from '../blockingHealth';

const base = { android: true, wantedApps: ['instagram' as const], supported: true, authorized: true, background: { batteryRestricted: false, hasAutoStart: true, maker: 'xiaomi' } };

describe('blocking health on Android', () => {
  it('says nothing on iPhone, without blocked apps, or when everything is set', () => {
    expect(blockingIssue({ ...base, android: false, authorized: false })).toBeNull();
    expect(blockingIssue({ ...base, wantedApps: [], authorized: false })).toBeNull();
    expect(blockingIssue(base)).toBeNull();
  });
  it('reports Accessibility switched off first, then battery saving', () => {
    expect(blockingIssue({ ...base, authorized: false, background: { ...base.background, batteryRestricted: true } })).toEqual({ kind: 'accessibilityOff', apps: ['instagram'] });
    expect(blockingIssue({ ...base, background: { ...base.background, batteryRestricted: true } })).toEqual({ kind: 'battery', maker: 'xiaomi', hasAutoStart: true });
  });
  it('names the phone maker', () => {
    expect(makerName('samsung')).toBe('Samsung');
    expect(makerName('')).toBe('');
  });
});
