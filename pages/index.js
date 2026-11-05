import Link from 'next/link';
import Seo from '../components/Seo';
import Composer from '../components/Composer';
import Feed from '../components/Feed';
import { OrcidIcon } from '../components/OrcidBadge';
import { withViewer } from '../lib/serverProps';
import { homeFeed, latestFeed, trendingTags } from '../lib/queries';

const AUTH_ERRORS = {
  denied: 'You cancelled the ORCID sign-in.',
  state_mismatch: 'Sign-in expired or was tampered with. Please try again.',
  missing_code: 'ORCID did not return a sign-in code. Please try again.',
  suspended: 'This account has been suspended by a moderator.',
  orcid_error: 'ORCID reported an error. Please try again.',
  login_failed: 'Sign-in failed. Please try again in a moment.',
};

export default function Home({ tab, posts, nextCursor, trending, authError, site }) {
  return (
    <>
      <Seo canonical={site && site.appUrl ? `${site.appUrl}/` : undefined} />
      <div className="two-col">
        <section className="main-col">
          {authError ? (
            <p className="error card" role="alert">
              {authError}
            </p>
          ) : null}
          {tab === 'welcome' ? <Hero /> : null}
          {tab !== 'welcome' ? <Composer /> : null}
          <div className="tabs" role="tablist">
            {tab !== 'welcome' ? (
              <Link href="/" className={tab === 'home' ? 'active' : ''} role="tab" aria-selected={tab === 'home'}>
                Following
              </Link>
            ) : null}
            <Link
              href="/?tab=latest"
              className={tab === 'latest' || tab === 'welcome' ? 'active' : ''}
              role="tab"
              aria-selected={tab !== 'home'}
            >
              Latest
            </Link>
          </div>
          <Feed
            initialPosts={posts}
            initialCursor={nextCursor}
            query={{ feed: tab === 'home' ? 'home' : 'latest' }}
            emptyText={
              tab === 'home'
                ? 'Your feed is empty. Follow researchers (try Search) or check the Latest tab.'
                : 'No posts yet - be the first to share something.'
            }
          />
        </section>
        <aside className="side-col">
          <div className="card">
            <h3>Trending tags</h3>
            {trending.length ? (
              <div className="tag-row">
                {trending.map((t) => (
                  <Link key={t.tag} href={`/t/${t.tag}`} className="chip">
                    #{t.tag} <span className="muted small">{t.n}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted small">Tags appear here as people post.</p>
            )}
          </div>
          <div className="card small">
            <h3>About</h3>
            <p>
              Every account on ResearchHuddle is tied to an authenticated ORCID iD, and profiles show publications
              imported from the researcher&apos;s public ORCID record.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function Hero() {
  return (
    <div className="hero card">
      <h1>Where researchers huddle.</h1>
      <p className="lead">
        A social network for scientists and scholars. Sign in with your ORCID iD - your profile, affiliations and
        publications come with you. No passwords, no fake experts.
      </p>
      <a href="/api/auth/orcid/login" className="btn orcid-btn">
        <OrcidIcon size={20} /> Sign in with ORCID
      </a>
      <p className="muted small">
        Don&apos;t have an ORCID iD? It&apos;s free at orcid.org. By signing in you agree to our{' '}
        <Link href="/privacy">privacy notice</Link>.
      </p>
    </div>
  );
}

export const getServerSideProps = withViewer(async ({ query }, viewer) => {
  let tab = 'welcome';
  if (viewer) tab = query.tab === 'latest' ? 'latest' : 'home';
  const before = typeof query.before === 'string' ? query.before : null;
  const feed = tab === 'home' ? await homeFeed(viewer.id, before) : await latestFeed(viewer ? viewer.id : null, before);
  const trending = await trendingTags(12);
  const errKey = typeof query.auth_error === 'string' ? query.auth_error : '';
  return {
    props: {
      tab,
      posts: feed.posts,
      nextCursor: feed.nextCursor,
      trending,
      authError: AUTH_ERRORS[errKey] || null,
    },
  };
});
