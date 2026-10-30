'use client';

import { AnimatePresence, animate, motion, useInView, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Number that counts up from zero the first time it is seen. */
export function CountUp({ to, locale }: { to: number; locale: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: 1.8, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to]);
  return <b ref={ref}>{value.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')}</b>;
}

/** Steps whose connecting line fills as the section scrolls past. */
export function StepsTrack({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'center 45%'] });
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <div ref={ref} className="steps">
      <div className="track" aria-hidden="true"><motion.div style={{ scaleX }} /></div>
      {children}
    </div>
  );
}

/** Accordion with smooth height animation. */
export function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {items.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <motion.div key={q} className="qa" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.05 }}>
            <button aria-expanded={isOpen} aria-controls={`qa-${i}`} id={`q-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
              {q}
              <motion.span className="plus" animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div id={`qa-${i}`} role="region" aria-labelledby={`q-${i}`} key="a"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
                  <p>{a}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Breathing rings around the logo, like the app's launch screen. */
export function PulseRings({ children }: { children: ReactNode }) {
  return (
    <div className="rings">
      {[150, 210, 280].map((size, i) => (
        <motion.span key={size} className="ring" style={{ width: size, height: size }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.7 - i * 0.15, 0.25, 0.7 - i * 0.15] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }} />
      ))}
      <motion.div style={{ position: 'relative' }} whileHover={{ rotate: -8, scale: 1.06 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>{children}</motion.div>
    </div>
  );
}

/** Adds a class once the element is in view (drives CSS-only effects such as the strike-through). */
export function InViewClass({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  return <div ref={ref} className={`${className}${inView ? ' in' : ''}`}>{children}</div>;
}
