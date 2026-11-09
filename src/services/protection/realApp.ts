import { Linking } from 'react-native';
import type { SocialAppId } from '../../types/app';

/** The real app's own link first; the website (which the real app usually claims) if that fails. */
const REAL_APP_URLS: Partial<Record<SocialAppId, string[]>> = {
  instagram: ['instagram://app', 'https://www.instagram.com/'],
  youtube: ['youtube://', 'https://www.youtube.com/'],
  tiktok: ['snssdk1233://', 'https://www.tiktok.com/'],
};

/** Opens the original app (for Post mode). Resolves to false when nothing could be opened. */
export async function openRealApp(platform: SocialAppId): Promise<boolean> {
  for (const url of REAL_APP_URLS[platform] ?? []) {
    try { await Linking.openURL(url); return true; } catch { /* try the next one */ }
  }
  return false;
}
