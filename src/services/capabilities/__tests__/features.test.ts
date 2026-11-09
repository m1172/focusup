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

  it('has text for every item in uz, ru and en', () => {
    const keys = vaqtimFeatures({ widget: true }).flatMap((group) => group.items.map((item) => item.key));
    for (const locale of ['uz', 'ru', 'en'] as const) for (const key of keys) expect(featuresTranslations[locale].item).toHaveProperty(key);
  });
});
