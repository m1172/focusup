'use client';

import { motion } from 'motion/react';
import { useState } from 'react';

type Plan = { name: string; tagline: string; items: readonly string[] };
type Labels = { monthly: string; yearly: string; perMonth: string; perYear: string; save: string; yearlyNote: string; soon: string; now: string; popular: string };
type Price = { month: number; year: number };

/** Free, Pro and Family side by side, with a monthly/yearly switch. Paid plans say "Coming soon" until they are on sale. */
export function Pricing({ free, pro, family, prices, labels, live }: {
  free: Plan & { price: string }; pro: Plan; family: Plan; prices: { pro: Price; family: Price }; labels: Labels; live: boolean;
}) {
  const [yearly, setYearly] = useState(true);
  const usd = (value: number) => `$${value.toFixed(2)}`;
  const list = (items: readonly string[]) => <ul className="list">{items.map((item) => <li key={item} className="list-long"><span className="dot ok">✓</span><span>{item}</span></li>)}</ul>;
  const paid = (plan: Plan, price: Price, featured: boolean) => (
    <div className={`card plan${featured ? ' featured' : ''}`}>
      <div className="plan-top">
        <h3 className="h3">{plan.name}</h3>
        {featured ? <span className="badge pick">{labels.popular}</span> : null}
        {!live ? <span className="badge soon">{labels.soon}</span> : null}
      </div>
      <p className="muted">{plan.tagline}</p>
      <p className="price"><b>{usd(yearly ? price.year : price.month)}</b><span>{yearly ? labels.perYear : labels.perMonth}</span></p>
      <p className="price-note">{yearly ? labels.yearlyNote.replace('{{price}}', usd(price.year / 12)) : ' '}</p>
      {list(plan.items)}
    </div>
  );
  return (
    <div className="pricing">
      <div className="tabs period" role="radiogroup" aria-label={`${labels.monthly} / ${labels.yearly}`}>
        {[false, true].map((value) => (
          <button key={String(value)} role="radio" aria-checked={yearly === value} className={`tab${yearly === value ? ' on' : ''}`} onClick={() => setYearly(value)}>
            {yearly === value ? <motion.span layoutId="period-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} /> : null}
            <span className="tab-name">{value ? labels.yearly : labels.monthly}</span>
          </button>
        ))}
        <span className="save">{labels.save}</span>
      </div>
      <div className="plans">
        <div className="card plan">
          <div className="plan-top"><h3 className="h3">{free.name}</h3><span className="badge feat">{labels.now}</span></div>
          <p className="muted">{free.tagline}</p>
          <p className="price"><b>{free.price}</b></p>
          <p className="price-note">{' '}</p>
          {list(free.items)}
        </div>
        {paid(pro, prices.pro, false)}
        {paid(family, prices.family, true)}
      </div>
    </div>
  );
}
