'use client';

import { useState } from 'react';

const FREE_DAY_HOURS = 8;
const BOOK_HOURS = 7;

/** Minutes a day of short videos → hours, free days and books a year. Plain arithmetic, shown with its assumptions. */
export function yearOf(minutesPerDay: number) {
  const hours = (minutesPerDay * 365) / 60;
  return { hours: Math.round(hours), days: Math.round(hours / FREE_DAY_HOURS), books: Math.floor(hours / BOOK_HOURS) };
}

export function TimeCalc({ locale, labels }: { locale: string; labels: { perDay: string; h: string; min: string; hours: string; days: string; books: string } }) {
  const [minutes, setMinutes] = useState(90);
  const year = yearOf(minutes);
  const number = (value: number) => value.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');
  const h = Math.floor(minutes / 60), m = minutes % 60;
  const time = [h ? `${h} ${labels.h}` : '', m ? `${m} ${labels.min}` : ''].filter(Boolean).join(' ');
  return (
    <div className="calc">
      <label className="calc-pick">
        <b>{time}</b> <span>{labels.perDay}</span>
        <input type="range" min={15} max={300} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-valuetext={`${time} ${labels.perDay}`} />
      </label>
      <div className="stats">
        <div className="stat"><b>{number(year.hours)}</b><span>{labels.hours}</span></div>
        <div className="stat"><b>{number(year.days)}</b><span>{labels.days}</span></div>
        <div className="stat"><b>{number(year.books)}</b><span>{labels.books}</span></div>
      </div>
    </div>
  );
}
