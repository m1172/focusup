import { generateInstagramBlockingScript } from '../generateScript';

import { JSDOM } from 'jsdom';

const HIDDEN = 'data-focusup-hidden';

function page(body: string, config: Record<string, boolean>) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, { url: 'https://www.instagram.com/', runScripts: 'outside-only', pretendToBeVisual: true });
  (dom.window as unknown as { eval: (code: string) => unknown }).eval(generateInstagramBlockingScript(config));
  return dom.window.document;
}

it('hides the Home Stories tray but keeps the feed and avatars inside posts', () => {
  const document = page(`<main><section>
    <div id="tray"><ul><li><a href="/stories/alice/1/" aria-label="Story by alice">a</a></li><li><a href="/stories/bob/2/" aria-label="Story by bob">b</a></li></ul></div>
    <div id="feed"><article><a href="/stories/carol/3/" aria-label="carol">c</a><a href="/p/xyz/">post</a></article></div>
  </section></main>`, { stories: true });
  const hidden = document.querySelector(`[${HIDDEN}="stories"]`);
  expect(hidden).not.toBeNull();
  expect(hidden?.contains(document.querySelector('a[href="/stories/alice/1/"]'))).toBe(true);
  expect(hidden?.contains(document.getElementById('feed'))).toBe(false);
  expect(document.querySelector('article')?.closest(`[${HIDDEN}]`)).toBeNull();
});

it('leaves Stories alone while the filter is off', () => {
  const document = page('<main><div><a href="/stories/alice/1/" aria-label="Story by alice">a</a><a href="/stories/bob/2/">b</a></div></main>', { stories: false });
  expect(document.querySelector(`[${HIDDEN}]`)).toBeNull();
});
