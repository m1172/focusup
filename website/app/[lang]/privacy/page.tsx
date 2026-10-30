import type { Metadata } from 'next';
import { alternates } from '@/alternates';
import { LegalPage } from '@/components/LegalPage';
import { privacy } from '@/content/legal';
import { UPDATED, isLocale, type Locale } from '@/content/site';

export async function generateMetadata({ params }: PageProps<'/[lang]/privacy'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: privacy[lang].title, alternates: alternates(lang, 'privacy/') };
}

export default async function Privacy({ params }: PageProps<'/[lang]/privacy'>) {
  const lang = (await params).lang as Locale;
  return <LegalPage doc={privacy[lang]} updated={UPDATED[lang]} />;
}
