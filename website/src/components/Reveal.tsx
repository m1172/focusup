'use client';

import { motion, useInView } from 'motion/react';
import { Fragment, useRef, type CSSProperties, type ReactNode } from 'react';

/** Fades and lifts its content in once it scrolls into view. */
export function Reveal({ children, delay = 0, y = 28, className, style }: { children: ReactNode; delay?: number; y?: number; className?: string; style?: CSSProperties }) {
  return (
    <motion.div className={className} style={style}
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.9, delay }}>
      {children}
    </motion.div>
  );
}

/** Headline that rises in word by word. */
export function Words({ text, className, as: Tag = 'h2', delay = 0, accent }: { text: string; className?: string; as?: 'h1' | 'h2'; delay?: number; accent?: number[] }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const words = text.split(' ');
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span aria-hidden="true" style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.2em', marginBottom: '-0.2em', verticalAlign: 'top' }}>
            <motion.span className={`word${accent?.includes(i) ? ' grad-text' : ''}`}
              initial={{ y: '110%' }} animate={inView ? { y: '0%' } : undefined}
              transition={{ duration: 0.85, delay: delay + i * 0.06 }}>
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  );
}

/** Card whose soft spotlight follows the pointer. */
export function SpotCard({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`card spot ${className}`} style={style}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}>
      {children}
    </div>
  );
}
