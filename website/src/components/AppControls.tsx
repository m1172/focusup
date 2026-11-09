'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

type Kind = 'always' | 'choose' | 'exp' | 'feature';
type App = { tagline: string; items: string[][] };
type Labels = { always: string; choose: string; experimental: string; featureLabel: string; hiddenLabel: string };

const NAMES = { instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok' } as const;
type AppId = keyof typeof NAMES;

/** Tabs per app: what is always off and what the person chooses. The switches are a demo, not a setting. */
export function AppControls({ apps, labels }: { apps: Record<AppId, App>; labels: Labels }) {
  const ids = Object.keys(NAMES) as AppId[];
  const [active, setActive] = useState<AppId>('instagram');
  const [off, setOff] = useState<Record<string, boolean>>({});
  const app = apps[active];
  return (
    <div className="controls">
      <div className="tabs" role="tablist" aria-label="Apps">
        {ids.map((id) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={id === active} aria-controls={`panel-${id}`} onClick={() => setActive(id)}
            className={`tab ${id}${id === active ? ' on' : ''}`}>
            {id === active ? <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} /> : null}
            <span className="tab-name">{NAMES[id]}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={active} role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="card panel"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
          <div className="panel-head"><p className="panel-tag">{app.tagline}</p><span aria-hidden="true">{labels.hiddenLabel}</span></div>
          <ul className="rows">
            {app.items.map(([name, kind]) => {
              const k = kind as Kind;
              const key = `${active}:${name}`;
              // The switch means "hidden". Short videos are always hidden; the others start hidden and can be tried.
              const hidden = k === 'always' || (k !== 'feature' && !off[key]);
              return (
                <li key={name} className="row">
                  <span className="row-name">{name}{k === 'exp' ? <em>{labels.experimental}</em> : null}</span>
                  <span className={`badge ${k === 'always' ? 'lock' : k === 'feature' ? 'feat' : 'pick'}`}>{k === 'always' ? labels.always : k === 'feature' ? labels.featureLabel : labels.choose}</span>
                  {k === 'feature' ? <span className="dot ok" aria-hidden="true">✓</span>
                    : <button type="button" role="switch" aria-checked={hidden} aria-label={`${name}: ${k === 'always' ? labels.always : labels.choose}`} disabled={k === 'always'}
                      className={`switch${hidden ? ' checked' : ''}`} onClick={() => setOff((prev) => ({ ...prev, [key]: !prev[key] }))}><i /></button>}
                </li>
              );
            })}
          </ul>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
