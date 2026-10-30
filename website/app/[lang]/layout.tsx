import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Providers } from '@/components/Providers';
import { SITE_URL, content, isLocale, locales } from '@/content/site';
import '../globals.css';

const manrope = localFont({
  src: [
    { path: '../../src/fonts/Manrope-500.ttf', weight: '500' },
    { path: '../../src/fonts/Manrope-700.ttf', weight: '700' },
    { path: '../../src/fonts/Manrope-800.ttf', weight: '800' },
  ],
  variable: '--font-manrope',
  display: 'swap',
});

export const dynamicParams = false;
export const generateStaticParams = () => locales.map((lang) => ({ lang }));

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F7F7FC' }, { media: '(prefers-color-scheme: dark)', color: '#0B0A12' }],
};

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = content[lang].meta;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t.title, template: '%s — Vaqtim' },
    description: t.description,
    icons: { icon: '/favicon.png', apple: '/icon.png' },
    openGraph: { title: t.title, description: t.description, images: ['/icon.png'], type: 'website', siteName: 'Vaqtim', locale: lang },
  };
}

export default async function LangLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className={manrope.variable}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Providers>
          <Header lang={lang} />
          <main id="main">{children}</main>
          <Footer lang={lang} />
        </Providers>
      </body>
    </html>
  );
}
