import Link from 'next/link';
import Seo from '../components/Seo';
import Avatar from '../components/Avatar';
import { withViewer } from '../lib/serverProps';
import { searchResearchers, searchTags } from '../lib/queries';
import { truncate, displayName } from '../lib/format';

export default function SearchPage({ q, results, tags, error }) {
  return (
    <>
      <Seo title={q ? `Search: ${q}` : 'Find researchers'} noindex />
      <div className="narrow">
        <h1 className="page-title">Find researchers</h1>
        <form method="get" action="/search" className="card search-form" role="search">
          <label htmlFor="search-q" className="sr-only">
            Name, keyword, institution or ORCID iD
          </label>
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, keyword, institution or ORCID iD"
            maxLength={100}
          />
          <button type="submit" className="btn primary">
            Search
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
        {tags.length ? (
          <div className="card">
            <h3>Matching tags</h3>
            <div className="tag-row">
              {tags.map((t) => (
                <Link key={t.tag} href={`/t/${t.tag}`} className="chip">
                  #{t.tag} <span className="muted small">{t.n}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {q && !error ? (
          <p className="muted small">
            {results.length} researcher{results.length === 1 ? '' : 's'} found
          </p>
        ) : null}
        <ul className="people">
          {results.map((r) => (
            <li key={r.orcid} className="card person">
              <Link href={`/r/${r.orcid}`} className="person-link">
                <Avatar name={r.name} orcid={r.orcid} size={44} />
                <span>
                  <strong>{displayName(r)}</strong>
                  <span className="small muted"> {r.orcid}</span>
                  {r.affiliation_text ? (
                    <span className="small block">{truncate(r.affiliation_text.split(' | ')[0], 120)}</span>
                  ) : null}
                  {r.keywords && r.keywords.length ? (
                    <span className="small muted block">{truncate(r.keywords.join(', '), 140)}</span>
                  ) : null}
                </span>
              </Link>
              <span className="small muted">{r.follower_count} followers</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export const getServerSideProps = withViewer(async ({ query }) => {
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  if (!q) return { props: { q: '', results: [], tags: [], error: null } };
  if (q.length < 2) return { props: { q, results: [], tags: [], error: 'Type at least 2 characters.' } };
  const [results, tags] = await Promise.all([searchResearchers(q), searchTags(q)]);
  return { props: { q, results, tags, error: null } };
});
