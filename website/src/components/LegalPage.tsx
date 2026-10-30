import type { LegalDoc } from '@/content/legal';
import { Reveal, Words } from './Reveal';

/** Privacy Policy / Terms. The text is our own trusted content, so its links render as HTML. */
export function LegalPage({ doc, updated }: { doc: LegalDoc; updated: string }) {
  return (
    <div className="page"><article className="wrap doc">
      <Words as="h1" text={doc.title} />
      <Reveal delay={0.1}>
        <p className="updated">{updated}</p>
        <p dangerouslySetInnerHTML={{ __html: doc.intro }} />
        {doc.sections.map(([heading, items]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            {items.length > 1
              ? <ul>{items.map((item) => <li key={item} dangerouslySetInnerHTML={{ __html: item }} />)}</ul>
              : <p dangerouslySetInnerHTML={{ __html: items[0] }} />}
          </section>
        ))}
      </Reveal>
    </article></div>
  );
}
