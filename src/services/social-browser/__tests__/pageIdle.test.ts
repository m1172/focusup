import { JSDOM } from 'jsdom';
import { createPageIdleScript } from '../pageIdle';

describe('hidden kept page', () => {
  let dom: JSDOM;
  let window: JSDOM['window'] & { eval: (script: string) => unknown };
  let played: number;
  let paused: number;

  beforeEach(() => {
    dom = new JSDOM('<video></video>', { url: 'https://www.instagram.com/', runScripts: 'outside-only', pretendToBeVisual: true });
    window = dom.window as typeof window;
    played = 0; paused = 0;
    // jsdom does not implement playback; stand in for a feed video that is already playing.
    Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', { configurable: true, get() { return played === paused; } });
    window.HTMLMediaElement.prototype.play = function () { played += 1; return Promise.resolve(); };
    window.HTMLMediaElement.prototype.pause = function () { paused += 1; };
    void window.document.querySelector('video')!.play();
  });
  afterEach(() => dom.window.close());

  it('tells the site it is hidden, pauses media and keeps it from restarting', async () => {
    const changes = jest.fn();
    window.document.addEventListener('visibilitychange', changes);
    const video = window.document.querySelector('video')!;
    window.eval(createPageIdleScript(true));
    expect(window.document.hidden).toBe(true);
    expect(window.document.visibilityState).toBe('hidden');
    expect(paused).toBe(1);
    await expect(video.play()).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(played).toBe(1);
    window.eval(createPageIdleScript(true));
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('restores the real visibility and playback when shown again', async () => {
    const changes = jest.fn();
    window.eval(createPageIdleScript(true));
    window.document.addEventListener('visibilitychange', changes);
    window.eval(createPageIdleScript(false));
    expect(window.document.hidden).toBe(false);
    expect(window.document.visibilityState).toBe('visible');
    expect(changes).toHaveBeenCalledTimes(1);
    await window.document.querySelector('video')!.play();
    expect(played).toBe(2);
  });
});
