export function isHomeYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://m.youtube.com');
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(parsed.hostname) && (parsed.pathname === '/' || parsed.pathname === '/home');
  } catch { return false; }
}

export function isWatchYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://m.youtube.com');
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(parsed.hostname) && parsed.pathname === '/watch';
  } catch { return false; }
}

export function isYouTubeShortsUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://m.youtube.com');
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(parsed.hostname) && /^\/shorts(?:\/|$)/i.test(parsed.pathname);
  } catch { return false; }
}
