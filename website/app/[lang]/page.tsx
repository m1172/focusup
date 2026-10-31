import type { Metadata } from 'next';
import { alternates } from '@/alternates';
import { icons } from '@/components/Icons';
import { Logo } from '@/components/Logo';
import { CountUp, Faq, InViewClass, PulseRings, StepsTrack } from '@/components/Motion';
import { PhoneDemo } from '@/components/PhoneDemo';
import { Reveal, SpotCard, Words } from '@/components/Reveal';
import { StoreButtons } from '@/components/StoreButtons';
import { content, isLocale, type Locale } from '@/content/site';

export async function generateMetadata({ params }: PageProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { alternates: alternates(lang, '') } : {};
}

export default async function Home({ params }: PageProps<'/[lang]'>) {
  const { lang: raw } = await params;
  const lang = raw as Locale;
  const t = content[lang];
  const chips = [
    { text: 'Reels', kind: 'x' as const }, { text: 'Shorts', kind: 'x' as const },
    { text: t.split.kept[0], kind: 'ok' as const }, { text: t.split.kept[2], kind: 'ok' as const },
  ];
  const tags = [...t.split.gone.map((text) => ({ text, kind: 'x' })), ...t.split.kept.map((text) => ({ text, kind: 'ok' }))];
  const privacyIcons = [icons.lock, icons.phone, icons.trash];

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="aurora" aria-hidden="true"><div className="blob a" /><div className="blob b" /><div className="blob c" /></div>
        <div className="grid-bg" aria-hidden="true" />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <Reveal y={16}><span className="eyebrow"><i />{t.hero.eyebrow}</span></Reveal>
            <Words as="h1" className="display" text={t.hero.title} accent={t.hero.accent} delay={0.1} />
            <Reveal delay={0.35}><p className="lead">{t.hero.lead}</p></Reveal>
            <Reveal delay={0.5}><StoreButtons lang={lang} /></Reveal>
            <Reveal delay={0.65}><p className="note">{t.hero.note.split('. ').filter(Boolean).map((part) => <span key={part}>{part.replace(/\.$/, '')}</span>)}</p></Reveal>
          </div>
          <PhoneDemo labels={{ ...t.phone, chips }} />
        </div>
      </section>

      {/* Marquee */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...tags, ...tags, ...tags, ...tags].map((tag, i) => (
            <span key={i} className="tag"><span className={tag.kind}>{tag.kind === 'x' ? '✕' : '✓'}</span>{tag.text}</span>
          ))}
        </div>
      </div>

      {/* Gone / kept */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <Words className="h2" text={t.split.title} />
            <Reveal delay={0.15}><p className="lead">{t.split.lead}</p></Reveal>
          </div>
          <div className="grid g2">
            <Reveal>
              <SpotCard>
                <div className="icon red">{icons.x}</div>
                <h3 className="h3">{t.split.goneTitle}</h3>
                <InViewClass><ul className="list">{t.split.gone.map((x) => <li key={x}><span className="dot x">✕</span><span className="strike">{x}</span></li>)}</ul></InViewClass>
              </SpotCard>
            </Reveal>
            <Reveal delay={0.12}>
              <SpotCard>
                <div className="icon mint">{icons.check}</div>
                <h3 className="h3">{t.split.keptTitle}</h3>
                <ul className="list">{t.split.kept.map((x) => <li key={x}><span className="dot ok">✓</span>{x}</li>)}</ul>
              </SpotCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section" id="how" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head"><Words className="h2" text={t.how.title} /></div>
          <StepsTrack>
            {t.how.steps.map(([h, p], i) => (
              <Reveal key={h} delay={i * 0.15}>
                <SpotCard style={{ height: '100%' }}>
                  <div className="step-n">{i + 1}</div>
                  <h3 className="h3" style={{ marginBottom: 10 }}>{h}</h3>
                  <p className="muted">{p}</p>
                </SpotCard>
              </Reveal>
            ))}
          </StepsTrack>
        </div>
      </section>

      {/* Numbers */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal>
            <div className="numbers">
              <h2 className="h2">{t.numbers.title}</h2>
              <p className="lead" style={{ marginTop: 16 }}>{t.numbers.lead}</p>
              <div className="stats">
                {t.numbers.stats.map(([n, label]) => <div key={label} className="stat"><CountUp to={Number(n)} locale={lang} /><span>{label}</span></div>)}
              </div>
              <p className="fine">{t.numbers.fine}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Privacy */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head"><Words className="h2" text={t.privacy.title} /></div>
          <div className="grid g3">
            {t.privacy.items.map(([h, p], i) => (
              <Reveal key={h} delay={i * 0.12}>
                <SpotCard style={{ height: '100%' }}>
                  <div className="icon">{privacyIcons[i]}</div>
                  <h3 className="h3" style={{ marginBottom: 10 }}>{h}</h3>
                  <p className="muted">{p}</p>
                </SpotCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>


      {/* FAQ */}
      <section className="section" id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head center"><Words className="h2" text={t.faq.title} /></div>
          <Faq items={t.faq.items as [string, string][]} />
        </div>
      </section>

      {/* Final CTA (the /app link sends computers here) */}
      <section className="section" id="download">
        <div className="wrap cta">
          <Reveal><PulseRings><Logo size={104} /></PulseRings></Reveal>
          <Words className="h2" text={t.final.title} />
          <Reveal delay={0.15}><p className="lead">{t.final.lead}</p></Reveal>
          <Reveal delay={0.25}><StoreButtons lang={lang} center /></Reveal>
        </div>
      </section>
    </>
  );
}
