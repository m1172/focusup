import type { Locale } from '../types/app';

// Uzbek reads as words ("4 soat 30 minut"); Russian and English keep compact units ("4ч 30м", "4h 30m").
const units: Record<Locale, { hour: string; minute: string }> = {
  uz: { hour: ' soat', minute: ' minut' },
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
