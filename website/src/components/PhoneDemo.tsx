'use client';

import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

type Labels = { app: string; clean: string; gone: string; who: string; chips: { text: string; kind: 'x' | 'ok' }[] };
type Phase = 'reel' | 'scan' | 'removed';

const looks = [
  { avatar: 'linear-gradient(135deg,#7A6DFF,#4338CA)', media: 'linear-gradient(135deg,#C9C4FA,#8C82FF)', reel: 'linear-gradient(160deg,#FF7A8A,#A35BFF)' },
  { avatar: 'linear-gradient(135deg,#6EF0C8,#0F7A5A)', media: 'linear-gradient(135deg,#9EF2D6,#3FAE95)', reel: 'linear-gradient(160deg,#FFB86B,#FF5E7E)' },
  { avatar: 'linear-gradient(135deg,#FFB86B,#FF7A59)', media: 'linear-gradient(135deg,#FFD9A8,#FF9F7A)', reel: 'linear-gradient(160deg,#5BC8FF,#7A6DFF)' },
];
// Chips sit just inside the stage so they never get cut off at the screen edge.
const chipSpots = [
  { left: '0%', top: '16%', depth: 60, delay: 0 },
  { right: '0%', top: '30%', depth: -50, delay: 0.6 },
  { left: '0%', top: '62%', depth: -80, delay: 1.2 },
  { right: '0%', top: '76%', depth: 70, delay: 1.8 },
];

/** Hero phone: a feed where each Reel is spotted, scanned and removed, on a loop. Tilts with the pointer. */
export function PhoneDemo({ labels }: { labels: Labels }) {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('reel');
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('scan'), 1400),
      setTimeout(() => setPhase('removed'), 2500),
      setTimeout(() => { setRound((r) => r + 1); setPhase('reel'); }, 5200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [round]);
  const look = looks[round % looks.length];
  const next = looks[(round + 1) % looks.length];

  // Pointer tilt and scroll parallax.
  const stage = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 120, damping: 18 });
  const rotateY = useSpring(ry, { stiffness: 120, damping: 18 });
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start start', 'end start'] });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, 120]);

  return (
    <div ref={stage} className="stage" style={{ perspective: 1200 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 14);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 10);
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0); }}>
      <motion.div style={{ rotateX, rotateY, y: phoneY }}
        initial={{ opacity: 0, y: 60, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, delay: 0.25 }}>
        <motion.div className="phone" animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="screen">
            <div className="island" />
            <div className="status"><span>9:41</span><span>●●● ▮</span></div>
            <div className="app-bar">
              <span>{labels.app}</span>
              <motion.span className="chip" key={phase === 'removed' ? 'on' : 'off'} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <i />{labels.clean}
              </motion.span>
            </div>
            <div className="feed">
              <AnimatePresence initial={false}>
                <Post key={`p-${round}`} look={look} who={labels.who} />
                {phase !== 'removed' ? (
                  <motion.div key={`reel-${round}`} layout className="reel" style={{ background: look.reel }}
                    initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6, height: 0, marginBottom: 0, filter: 'blur(6px)', transition: { duration: 0.55 } }}>
                    <span>▶ REELS</span>
                    {phase === 'scan' ? (
                      <motion.div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: '#6EF0C8', boxShadow: '0 0 18px 4px rgba(110,240,200,.8)' }}
                        initial={{ top: '0%' }} animate={{ top: '100%' }} transition={{ duration: 1, ease: 'linear' }} />
                    ) : null}
                  </motion.div>
                ) : (
                  <motion.div key={`gone-${round}`} layout className="removed"
                    initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}>
                    ✕ {labels.gone}
                  </motion.div>
                )}
                <Post key={`q-${round}`} look={next} who={labels.who} short />
              </AnimatePresence>
            </div>
            <div className="tabbar"><i /><i /><motion.i className="gone" animate={{ opacity: [0.35, 0.8, 0.35] }} transition={{ duration: 2.4, repeat: Infinity }} /><i /><i /></div>
          </div>
        </motion.div>
      </motion.div>
      {labels.chips.map((chip, i) => <FloatChip key={chip.text} chip={chip} spot={chipSpots[i % chipSpots.length]} progress={scrollYProgress} />)}
    </div>
  );
}

function Post({ look, who, short = false }: { look: (typeof looks)[number]; who: string; short?: boolean }) {
  return (
    <motion.div layout className="post" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
      <div className="who"><span className="avatar" style={{ background: look.avatar }} />{who}</div>
      <div className="media" style={{ background: look.media, height: short ? 90 : 128 }} />
      <div className="bar" />
    </motion.div>
  );
}

function FloatChip({ chip, spot, progress }: { chip: Labels['chips'][number]; spot: (typeof chipSpots)[number]; progress: ReturnType<typeof useScroll>['scrollYProgress'] }) {
  const y = useTransform(progress, [0, 1], [0, spot.depth]);
  const { depth: _depth, delay, ...position } = spot;
  return (
    <motion.div className="float" style={{ ...position, y }}
      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.9 + delay * 0.4, type: 'spring', stiffness: 260, damping: 18 }}>
      <motion.span style={{ display: 'inline-flex', gap: 8 }} animate={{ y: [0, -6, 0] }} transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay }}>
        <span className={chip.kind}>{chip.kind === 'x' ? '✕' : '✓'}</span>{chip.text}
      </motion.span>
    </motion.div>
  );
}
