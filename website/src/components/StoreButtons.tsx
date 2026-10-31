'use client';

import { motion } from 'motion/react';
import { STORE, content, type Locale } from '@/content/site';

const Apple = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2.1-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.8 1.3 10.3.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.2zM13.9 5c.7-.9 1.2-2 1-3.2-1 .1-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>;
const Play = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 2.6c-.3.3-.4.7-.4 1.2v16.4c0 .5.1.9.4 1.2l9.1-9.4L4 2.6zm10.4 8.1 2.6-2.7L6.3 1.9c-.3-.2-.7-.2-1 0l9.1 8.8zm0 2.6-9.1 8.8c.3.2.7.2 1 0l10.7-6.1-2.6-2.7zm6.4-2.1-2.8-1.6-2.8 2.9 2.8 2.9 2.8-1.6c.8-.5.8-1.7 0-2.6z"/></svg>;

/** App Store / Google Play buttons. A store without a link reads "coming soon". */
export function StoreButtons({ lang, center = false }: { lang: Locale; center?: boolean }) {
  const t = content[lang].store;
  const items = [
    { url: STORE.ios, label: t.ios, icon: <Apple />, primary: true },
    { url: STORE.android, label: t.android, icon: <Play />, primary: false },
  ];
  return (
    <div className="btns" style={center ? { justifyContent: 'center' } : undefined}>
      {items.map(({ url, label, icon, primary }) => {
        const inner = <>{icon}<span className="label">{url ? null : <small>{t.soon}</small>}{label}</span></>;
        const props = { className: `btn${primary ? ' btn-primary' : ''}`, whileHover: { y: -3, scale: 1.02 }, whileTap: { scale: 0.97 }, transition: { type: 'spring' as const, stiffness: 400, damping: 25 } };
        return url
          ? <motion.a key={label} href={url} {...props}>{inner}</motion.a>
          : <motion.span key={label} aria-disabled="true" {...props}>{inner}</motion.span>;
      })}
    </div>
  );
}
