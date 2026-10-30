'use client';

import Lenis from 'lenis';
import { MotionConfig } from 'motion/react';
import { useEffect, type ReactNode } from 'react';

/** Smooth, inertial scrolling (Lenis) and Motion settings that follow the visitor's reduced-motion preference. */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: -90 } });
    return () => lenis.destroy();
  }, []);
  return <MotionConfig reducedMotion="user" transition={{ ease: [0.22, 1, 0.36, 1] }}>{children}</MotionConfig>;
}
