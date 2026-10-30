import Link from 'next/link';
import { content, type Locale } from '@/content/site';
import { Wordmark } from './Logo';

export function Footer({ lang }: { lang: Locale }) {
  const t = content[lang].footer;
  const b = `/${lang}/`;
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="foot">
          <div>
            <Link className="brand" href={b}><Wordmark size={30} /></Link>
            <p className="copy">© {new Date().getFullYear()} Vaqtim. {t.rights}</p>
          </div>
          <nav aria-label="Footer">
            <Link href={`${b}support/`}>{t.support}</Link>
            <Link href={`${b}privacy/`}>{t.privacy}</Link>
            <Link href={`${b}terms/`}>{t.terms}</Link>
            <Link href={`${b}delete-account/`}>{t.del}</Link>
          </nav>
        </div>
        <p className="copy">{t.disclaimer}</p>
      </div>
    </footer>
  );
}
