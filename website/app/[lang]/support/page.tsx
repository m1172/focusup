import type { Metadata } from 'next';
import { alternates } from '@/alternates';
import { icons } from '@/components/Icons';
import { Reveal, SpotCard, Words } from '@/components/Reveal';
import { SUPPORT_EMAIL, content, isLocale, type Locale } from '@/content/site';

export async function generateMetadata({ params }: PageProps<'/[lang]/support'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: content[lang].support.title, description: content[lang].support.lead, alternates: alternates(lang, 'support/') };
}

export default async function Support({ params }: PageProps<'/[lang]/support'>) {
  const lang = (await params).lang as Locale;
  const t = content[lang].support;
  return (
    <div className="page"><div className="wrap doc">
      <Words as="h1" text={t.title} />
      <Reveal delay={0.15}><p className="lead">{t.lead}</p></Reveal>
      <div className="grid g2" style={{ marginTop: 40 }}>
        <Reveal><SpotCard style={{ height: '100%' }}><div className="icon">{icons.chat}</div><h3 className="h3" style={{ marginBottom: 10 }}>{t.appTitle}</h3><p className="muted">{t.app}</p></SpotCard></Reveal>
        <Reveal delay={0.1}><SpotCard style={{ height: '100%' }}><div className="icon mint">{icons.mail}</div><h3 className="h3" style={{ marginBottom: 10 }}>{t.mailTitle}</h3><p className="muted" style={{ marginBottom: 18 }}><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p><a className="btn btn-sm" href={`mailto:${SUPPORT_EMAIL}`}>{t.mailCta} →</a></SpotCard></Reveal>
      </div>
    </div></div>
  );
}
