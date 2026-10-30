import { useId } from 'react';

/** The Vaqtim app icon (same shape as the app's FocusLogo and assets/icon.png). */
export function Logo({ size = 36 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flex: 'none', borderRadius: size * (19 / 64) }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7A6DFF" /><stop offset="1" stopColor="#4338CA" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="19" fill={`url(#${id})`} />
      <path d="M45.59 25.66A15 15 0 1 1 32 17" fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
      <path d="M32 23.5V32l6 4" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="40.06" cy="19.35" r="3.4" fill="#6EF0C8" />
    </svg>
  );
}

export function Wordmark({ size = 34 }: { size?: number }) {
  return <><Logo size={size} /><span>Vaqt<b>im</b></span></>;
}
