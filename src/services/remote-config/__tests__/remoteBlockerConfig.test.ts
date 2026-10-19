import { isSafeRemoteSelector, validateRemoteBlockerConfig } from '../remoteBlockerConfig';

describe('remote blocker configuration validation', () => {
  it('accepts bounded, structured feature switches and versions', () => {
    expect(validateRemoteBlockerConfig({
      schemaVersion: 1,
      platforms: {
        instagram: { version: 4, enabled: true, features: { reels: false, explore: true } },
        youtube: { version: 8, enabled: true, features: { shorts: true } },
      },
    })).toEqual({
      schemaVersion: 1,
      platforms: {
        instagram: { version: 4, enabled: true, features: { reels: false, explore: true } },
        youtube: { version: 8, enabled: true, features: { shorts: true } },
      },
    });
  });

  it('rejects executable payloads, unknown selectors and malformed booleans', () => {
    expect(validateRemoteBlockerConfig({ schemaVersion: 1, platforms: {}, script: 'alert(1)' })).toBeNull();
    expect(validateRemoteBlockerConfig({ schemaVersion: 1, platforms: { instagram: { version: 1, enabled: true, features: { reels: true, selector: 'body *' } } } })).toBeNull();
    expect(validateRemoteBlockerConfig({ schemaVersion: 1, platforms: { youtube: { version: 1, enabled: true, features: { shorts: 'yes' } } } })).toBeNull();
    expect(validateRemoteBlockerConfig({ schemaVersion: 2, platforms: {} })).toBeNull();
  });
  it('accepts only selectors within trusted feature containers and constrained short-form routes', () => {
    expect(isSafeRemoteSelector('instagram', 'suggestedPosts', 'article[data-layout="new"]')).toBe(true);
    expect(isSafeRemoteSelector('youtube', 'homeRecommendations', 'body')).toBe(false);
    expect(isSafeRemoteSelector('instagram', 'reels', 'a[onclick="steal()"]')).toBe(false);
    expect(isSafeRemoteSelector('instagram', 'suggestedPosts', 'article:has(input)')).toBe(false);
    expect(validateRemoteBlockerConfig({ schemaVersion: 1, platforms: { youtube: { version: 3, enabled: true, features: {}, selectors: { homeRecommendations: ['ytm-rich-grid-renderer'] }, routes: ['/feed/shorts'] } } })).not.toBeNull();
    expect(validateRemoteBlockerConfig({ schemaVersion: 1, platforms: { youtube: { version: 3, enabled: true, features: {}, routes: ['/results?search_query=private'] } } })).toBeNull();
  });
});
