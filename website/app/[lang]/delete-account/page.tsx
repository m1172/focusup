import type { Metadata } from 'next';
import { alternates } from '@/alternates';
import { Reveal, Words } from '@/components/Reveal';
import { SUPPORT_EMAIL, content, isLocale, type Locale } from '@/content/site';

export async function generateMetadata({ params }: PageProps<'/[lang]/delete-account'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: content[lang].del.title, description: content[lang].del.lead, alternates: alternates(lang, 'delete-account/') };
}

export default async function DeleteAccount({ params }: PageProps<'/[lang]/delete-account'>) {
  const lang = (await params).lang as Locale;
  const t = content[lang].del;
  return (
    <div className="page"><div className="wrap doc">
      <Words as="h1" text={t.title} />
      <Reveal delay={0.15}><p className="lead">{t.lead}</p></Reveal>
      <Reveal delay={0.25}>
        <h2>{t.appTitle}</h2>
        <ol>{t.appSteps.map((s) => <li key={s}>{s}</li>)}</ol>
        <h2>{t.mailTitle}</h2>
        <p>{t.mail} <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t.title)}`}>{SUPPORT_EMAIL}</a></p>
        <h2>{t.whatTitle}</h2>
        <ul>{t.what.map((s) => <li key={s}>{s}</li>)}</ul>
        <h2>{t.keepTitle}</h2>
        <p>{t.keep}</p>
      </Reveal>
    </div></div>
  );
}
