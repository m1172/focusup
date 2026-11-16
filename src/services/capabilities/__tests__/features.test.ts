import { vaqtimFeatures } from '../features';
import { featuresTranslations } from '../../../translations/features';

describe('Vaqtim features page', () => {
  it('never lists unsupported things as working', () => {
    const all = vaqtimFeatures({ widget: false }).flatMap((group) => group.items);
    const status = (key: string) => all.find((item) => item.key === key)?.status;
    for (const key of ['youtubeAds', 'snapchat', 'systemGrayscale', 'widget']) expect(status(key)).toBe('notAvailable');
    expect(vaqtimFeatures({ widget: true }).flatMap((group) => group.items).find((item) => item.key === 'widget')?.status).toBe('available');
    // Short-video feeds are always blocked.
    expect(all.filter((item) => item.alwaysOn).map((item) => item.key)).toEqual(['reels', 'shorts', 'forYou']);
  });

  it('lists paid plans only when they can be bought', () => {
    const groups = (options: Parameters<typeof vaqtimFeatures>[0]) => vaqtimFeatures(options).map((entry) => entry.group);
    expect(groups({ widget: false })).toEqual(['instagram', 'youtube', 'tiktok', 'general']);
    expect(groups({ widget: false, pro: true })).toEqual(['instagram', 'youtube', 'tiktok', 'general', 'pro']);
    expect(groups({ widget: false, pro: true, family: true })).toEqual(['instagram', 'youtube', 'tiktok', 'general', 'pro', 'family']);
    // Nothing free moves under a paid heading.
    const free = vaqtimFeatures({ widget: false }).flatMap((entry) => entry.items);
    expect(vaqtimFeatures({ widget: false, pro: true, family: true }).slice(0, 4).flatMap((entry) => entry.items)).toEqual(free);
  });

  it('has text for every item in uz, ru and en', () => {
    const keys = vaqtimFeatures({ widget: true, pro: true, family: true }).flatMap((group) => group.items.map((item) => item.key));
    for (const locale of ['uz', 'ru', 'en'] as const) for (const key of keys) expect(featuresTranslations[locale].item).toHaveProperty(key);
  });
});
