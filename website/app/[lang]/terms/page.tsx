import type { Metadata } from 'next';
import { alternates } from '@/alternates';
import { LegalPage } from '@/components/LegalPage';
import { terms } from '@/content/legal';
import { UPDATED, isLocale, type Locale } from '@/content/site';

export async function generateMetadata({ params }: PageProps<'/[lang]/terms'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: terms[lang].title, alternates: alternates(lang, 'terms/') };
}

export default async function Terms({ params }: PageProps<'/[lang]/terms'>) {
  const lang = (await params).lang as Locale;
  return <LegalPage doc={terms[lang]} updated={UPDATED[lang]} />;
}
