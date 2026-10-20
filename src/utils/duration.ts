import type { Locale } from '../types/app';

const units: Record<Locale, { hour: string; minute: string; lessThanMinute: string }> = {
  uz: { hour: ' soat', minute: ' minut', lessThanMinute: '<1 minut' },
  ru: { hour: 'ч', minute: 'м', lessThanMinute: '<1 мин' },
  en: { hour: 'h', minute: 'm', lessThanMinute: '<1 min' },
};

export function formatDurationMs(durationMs: number, locale: Locale): string {
  if (durationMs <= 0) return `0${units[locale].minute}`;
  const wholeMinutes = Math.floor(durationMs / 60_000);
  if (wholeMinutes === 0) return units[locale].lessThanMinute;
  const minutes = wholeMinutes;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const unit = units[locale];
  if (hours === 0) return `${remainder}${unit.minute}`;
  return remainder === 0 ? `${hours}${unit.hour}` : `${hours}${unit.hour} ${remainder}${unit.minute}`;
}
