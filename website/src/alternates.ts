import type { Metadata } from 'next';
import { locales, type Locale } from '@/content/site';

/** Canonical URL and hreflang links for a page that exists in every language. `page` is e.g. '' or 'privacy/'. */
export function alternates(lang: Locale, page: string): Metadata['alternates'] {
  return {
    canonical: `/${lang}/${page}`,
    languages: { ...Object.fromEntries(locales.map((l) => [l, `/${l}/${page}`])), 'x-default': `/uz/${page}` },
  };
}
