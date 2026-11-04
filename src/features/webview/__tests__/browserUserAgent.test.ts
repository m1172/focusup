import { chromeUserAgent } from '../browserUserAgent';

describe('Instagram user agent on Android', () => {
  it('removes the in-app web view markers and keeps everything else', () => {
    const webView = 'Mozilla/5.0 (Linux; Android 16; sdk_gphone64_arm64 Build/BP22.250124.010; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/133.0.6943.137 Mobile Safari/537.36';
    expect(chromeUserAgent(webView)).toBe('Mozilla/5.0 (Linux; Android 16; sdk_gphone64_arm64 Build/BP22.250124.010) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.137 Mobile Safari/537.36');
  });

  it('leaves a user agent without the markers unchanged', () => {
    const chrome = 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36';
    expect(chromeUserAgent(chrome)).toBe(chrome);
  });
});
