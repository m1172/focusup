import { JSDOM } from 'jsdom';
import { createAppPromoScript } from '../appPromo';

describe('open-app button removal', () => {
  let dom: JSDOM;
  const hidden = (selector: string) => dom.window.document.querySelector(selector)?.hasAttribute('data-focusup-app-promo');
  const nextFrame = () => new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve(undefined)));

  beforeEach(() => {
    dom = new JSDOM(`<main>
      <h1>Share everyday moments with your close friends.</h1>
      <button id="open">Open Instagram</button>
      <button id="login">Log In</button><button id="signup">Sign Up</button>
      <a id="store" href="https://apps.apple.com/app/instagram/id389801252">Instagram</a>
      <a id="profile" href="/open.app/">open.app</a>
      <article><span>Open app</span></article>
    </main>`, { url: 'https://www.instagram.com/', runScripts: 'outside-only', pretendToBeVisual: true });
  });
  afterEach(() => {
    (dom.window as unknown as { __focusUpAppPromo?: { observer?: MutationObserver } }).__focusUpAppPromo?.observer?.disconnect();
    dom.window.close();
  });

  it('hides app hand-off buttons and keeps Log In and Sign Up', () => {
    dom.window.eval(createAppPromoScript());
    expect(hidden('#open')).toBe(true);
    expect(hidden('#store')).toBe(true);
    expect(hidden('#login')).toBe(false);
    expect(hidden('#signup')).toBe(false);
    expect(hidden('#profile')).toBe(false);
    expect(hidden('article span')).toBe(false);
    expect(dom.window.document.querySelectorAll('#focusup-app-promo-styles')).toHaveLength(1);
  });

  it('hides buttons rendered later, whole YouTube upsell prompts, and translated labels', async () => {
    dom.window.eval(createAppPromoScript());
    dom.window.eval(createAppPromoScript());
    const document = dom.window.document;
    document.body.insertAdjacentHTML('beforeend', `
      <ytm-app-upsell-renderer id="upsell"><div><ytm-button-renderer><button>Open App</button></ytm-button-renderer></div></ytm-app-upsell-renderer>
      <div role="button" id="ru">Открыть приложение</div>
      <button id="uz" aria-label="Ilovani ochish"><svg></svg></button>`);
    await nextFrame();
    expect(hidden('#upsell')).toBe(true);
    expect(hidden('#ru')).toBe(true);
    expect(hidden('#uz')).toBe(true);
    expect(document.querySelectorAll('#focusup-app-promo-styles')).toHaveLength(1);
  });
});
