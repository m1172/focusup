import type { MetadataRoute } from 'next';
import { SITE_URL, locales } from '@/content/site';

export const dynamic = 'force-static';
const pages = ['', 'support/', 'privacy/', 'terms/', 'delete-account/'];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((lang) => pages.map((page) => ({
    url: `${SITE_URL}/${lang}/${page}`,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/${page}`])) },
  })));
}
