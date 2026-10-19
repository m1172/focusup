import type { Locale } from '../types/app';

const units: Record<Locale, { hour: string; minute: string }> = {
  uz: { hour: 's', minute: 'd' },
  ru: { hour: 'ч', minute: 'м' },
  en: { hour: 'h', minute: 'm' },
};

export function formatDuration(totalMinutes: number, locale: Locale): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const unit = units[locale];
  if (hours === 0) return `${minutes}${unit.minute}`;
  return minutes === 0 ? `${hours}${unit.hour}` : `${hours}${unit.hour} ${minutes}${unit.minute}`;
}
