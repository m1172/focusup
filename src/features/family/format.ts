import type { TFunction } from 'i18next';
import { appCatalog } from '../apps/catalog';
import type { SocialAppId } from '../../types/app';

/** 24-hour local time, as used across Uzbekistan and Russia. */
export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function timeAgo(t: TFunction, at: string | number | null, now = Date.now()): string | null {
  const time = typeof at === 'string' ? Date.parse(at) : at;
  if (!time || !Number.isFinite(time)) return null;
  const minutes = Math.max(0, Math.floor((now - time) / 60_000));
  if (minutes < 1) return t('family.parent.justNow');
  if (minutes < 60) return t('family.parent.minutesAgo', { count: minutes });
  if (minutes < 60 * 24) return t('family.parent.hoursAgo', { count: Math.floor(minutes / 60) });
  return t('family.parent.daysAgo', { count: Math.floor(minutes / 1440) });
}

export const appNames = (apps: SocialAppId[]) => apps.map((app) => appCatalog[app]?.name ?? app).join(', ');
