import { resources } from '..';

type Tree = Record<string, unknown>;
/** Flattens nested translation objects into dotted keys; arrays keep their length so lists stay aligned. */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix + key;
    if (Array.isArray(value)) acc[path] = `array:${value.length}`;
    else if (value && typeof value === 'object') Object.assign(acc, flatten(value as Tree, `${path}.`));
    else acc[path] = typeof value;
    return acc;
  }, {});
}

describe('translation resources', () => {
  it('keeps the same UI keys in Uzbek, Russian and English', () => {
    const keys = Object.keys(resources.uz.translation).sort();
    expect(Object.keys(resources.ru.translation).sort()).toEqual(keys);
    expect(Object.keys(resources.en.translation).sort()).toEqual(keys);
  });

  it('keeps every nested key and list length identical across languages', () => {
    const uz = flatten(resources.uz.translation as Tree);
    expect(flatten(resources.ru.translation as Tree)).toEqual(uz);
    expect(flatten(resources.en.translation as Tree)).toEqual(uz);
  });

  it('has no empty strings', () => {
    for (const lang of ['uz', 'ru', 'en'] as const) {
      const walk = (value: unknown, path: string): void => {
        if (typeof value === 'string') expect(`${lang}:${path}:${value.trim().length > 0}`).toBe(`${lang}:${path}:true`);
        else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => walk(child, `${path}.${key}`));
      };
      walk(resources[lang].translation, '');
    }
  });
});
