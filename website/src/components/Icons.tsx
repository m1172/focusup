// Small stroke icons for feature cards (24px grid).
const base = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const icons = {
  lock: <svg {...base}><rect x="4" y="10.5" width="16" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>,
  phone: <svg {...base}><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 18.5h3" /></svg>,
  trash: <svg {...base}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /></svg>,
  x: <svg {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  check: <svg {...base}><path d="m5 12.5 4.5 4.5L19 7" /></svg>,
  clock: <svg {...base}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  moon: <svg {...base}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>,
  chart: <svg {...base}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  link: <svg {...base}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
  mail: <svg {...base}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>,
  chat: <svg {...base}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z" /></svg>,
};
