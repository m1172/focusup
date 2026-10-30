'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useState } from 'react';
import { content, locales, type Locale } from '@/content/site';
import { Wordmark } from './Logo';

/** Floating glass header. Slides away while scrolling down and comes back on the way up. */
export function Header({ lang }: { lang: Locale }) {
  const t = content[lang].nav;
  const pathname = usePathname() ?? `/${lang}/`;
  const rest = pathname.replace(/^\/(uz|ru|en)(\/|$)/, '');
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => {
    const previous = scrollY.getPrevious() ?? 0;
    setHidden(y > 160 && y > previous);
  });
  return (
    <motion.header className="header" initial={{ y: -90, opacity: 0 }} animate={{ y: hidden ? -100 : 0, opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="wrap">
        <div className="header-bar">
          <Link className="brand" href={`/${lang}/`} aria-label="Vaqtim"><Wordmark size={34} /></Link>
          <nav className="nav" aria-label="Main">
            <Link className="hide-sm" href={`/${lang}/#how`}>{t.how}</Link>
            <Link className="hide-sm" href={`/${lang}/support/`}>{t.support}</Link>
            <Link className="hide-sm" href={`/${lang}/#faq`}>{t.faq}</Link>
            <div className="lang" role="group" aria-label="Language">
              {locales.map((l) => (
                <a key={l} href={`/${l}/${rest}`} hrefLang={l} lang={l} aria-current={l === lang ? 'true' : undefined}>
                  {l === lang ? <motion.span className="pill" layoutId="lang-pill" /> : null}
                  {l.toUpperCase()}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </motion.header>
  );
}
