import { useState } from 'react';
import { useRouter } from 'next/router';
import Seo from '../../components/Seo';
import Avatar from '../../components/Avatar';
import OrcidBadge from '../../components/OrcidBadge';
import FollowButton from '../../components/FollowButton';
import Feed from '../../components/Feed';
import { useApp } from '../../components/AppContext';
import { postJson } from '../../lib/clientApi';
import { withViewer } from '../../lib/serverProps';
import { getProfile, getWorks, userPosts } from '../../lib/queries';
import { isValidOrcid, normaliseOrcid } from '../../lib/orcid-id';
import { formatDate, truncate, displayName } from '../../lib/format';
import { doiUrl } from '../../lib/validate';

const AFF_LABELS = {
  employment: 'Employment',
  education: 'Education',
  'invited-position': 'Invited position',
  qualification: 'Qualification',
};

function years(a) {
  if (!a.startYear && !a.endYear) return '';
  return `${a.startYear || '?'} - ${a.endYear || 'present'}`;
}

function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function refresh() {
    setBusy(true);
    setMsg('');
    try {
      const r = await postJson('/api/me/refresh', {});
      setMsg(`Updated: ${r.works} works, ${r.affiliations} affiliations.`);
      router.replace(router.asPath, undefined, { scroll: false });
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="refresh">
      <button type="button" className="btn ghost small" onClick={refresh} disabled={busy}>
        {busy ? 'Refreshing…' : '↻ Refresh from ORCID'}
      </button>
      {msg ? <span className="small muted"> {msg}</span> : null}
    </span>
  );
}

export default function ProfilePage({ profile, works, posts, nextCursor }) {
  const { viewer, site } = useApp();
  const [followers, setFollowers] = useState(profile.follower_count);
  const [tab, setTab] = useState('posts');
  const name = displayName(profile);
  const isMe = viewer && viewer.orcid === profile.orcid;
  const current = profile.affiliations.find((a) => a.type === 'employment' && !a.endYear);
  const canonical = `${site.appUrl}/r/${profile.orcid}`;
  const description =
    truncate(profile.biography, 160) ||
    `${name}${current && current.organization ? `, ${current.organization}` : ''} - verified ORCID researcher profile with ${works.length} publications on ResearchHuddle.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name,
      identifier: `${site.orcidBase}/${profile.orcid}`,
      sameAs: [`${site.orcidBase}/${profile.orcid}`],
      description: profile.biography ? truncate(profile.biography, 300) : undefined,
      affiliation: current && current.organization ? { '@type': 'Organization', name: current.organization } : undefined,
      knowsAbout: profile.keywords.length ? profile.keywords : undefined,
    },
  };

  return (
    <>
      <Seo
        title={`${name} (${profile.orcid})`}
        description={description}
        canonical={canonical}
        type="profile"
        noindex={!!profile.suspended_at || (!works.length && !profile.post_count)}
        jsonLd={profile.suspended_at ? null : jsonLd}
      />
      {profile.suspended_at ? <p className="error card">This account is suspended (visible to admins only).</p> : null}
      <section className="profile card">
        <div className="profile-head">
          <Avatar name={profile.name} orcid={profile.orcid} size={84} />
          <div className="profile-id">
            <h1>{name}</h1>
            {current ? (
              <p className="affil-line">
                {[current.role, current.department, current.organization].filter(Boolean).join(', ')}
              </p>
            ) : null}
            <OrcidBadge orcid={profile.orcid} orcidBase={site.orcidBase} />
            <p className="stats small">
              <strong>{followers}</strong> followers · <strong>{profile.following_count}</strong> following ·{' '}
              <strong>{profile.post_count}</strong> posts · <strong>{works.length}</strong> works
            </p>
          </div>
          <div className="profile-actions">
            {isMe ? (
              <RefreshButton />
            ) : (
              <FollowButton
                orcid={profile.orcid}
                initialFollowing={profile.is_following}
                onChange={(r) => setFollowers(r.followerCount)}
              />
            )}
          </div>
        </div>
        {profile.biography ? <p className="bio">{profile.biography}</p> : null}
        {profile.keywords.length ? (
          <div className="tag-row">
            {profile.keywords.map((k) => (
              <a key={k} href={`/search?q=${encodeURIComponent(k)}`} className="chip">
                {k}
              </a>
            ))}
          </div>
        ) : null}
        <p className="muted small">
          {profile.last_import_at
            ? `Profile imported from the public ORCID record on ${formatDate(profile.last_import_at)}.`
            : 'Public ORCID record not imported yet.'}
          {' '}Joined {formatDate(profile.created_at)}.
        </p>
      </section>

      <div className="two-col">
        <section className="main-col">
          <div className="tabs" role="tablist">
            <button type="button" className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>
              Posts
            </button>
            <button type="button" className={tab === 'works' ? 'active' : ''} onClick={() => setTab('works')}>
              Publications ({works.length})
            </button>
          </div>
          {tab === 'posts' ? (
            <Feed
              initialPosts={posts}
              initialCursor={nextCursor}
              query={{ author: profile.orcid }}
              emptyText={`${name} hasn't posted yet.`}
            />
          ) : (
            <Works works={works} />
          )}
        </section>
        <aside className="side-col">
          <div className="card">
            <h3>Affiliations</h3>
            {profile.affiliations.length ? (
              <ul className="affil-list">
                {profile.affiliations.map((a, i) => (
                  <li key={i}>
                    <strong>{a.organization}</strong>
                    {a.department ? <span>, {a.department}</span> : null}
                    <br />
                    <span className="small muted">
                      {[AFF_LABELS[a.type], a.role, [a.city, a.country].filter(Boolean).join(', '), years(a)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No public affiliations on the ORCID record.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function Works({ works }) {
  if (!works.length) {
    return <p className="empty card">No public works on the ORCID record yet.</p>;
  }
  return (
    <ol className="works card">
      {works.map((w) => (
        <li key={w.id}>
          <span className="work-title">
            {w.doi ? (
              <a href={doiUrl(w.doi)} target="_blank" rel="noopener noreferrer">
                {w.title}
              </a>
            ) : w.url ? (
              <a href={w.url} target="_blank" rel="noopener noreferrer nofollow">
                {w.title}
              </a>
            ) : (
              w.title
            )}
          </span>
          <span className="small muted">
            {[w.journal, w.year, w.work_type ? w.work_type.replace(/-/g, ' ') : null].filter(Boolean).join(' · ')}
          </span>
          {w.doi ? <span className="small doi-text">doi:{w.doi}</span> : null}
        </li>
      ))}
    </ol>
  );
}

export const getServerSideProps = withViewer(async ({ params }, viewer) => {
  const orcid = normaliseOrcid(params.orcid);
  if (!isValidOrcid(orcid)) return { notFound: true };
  if (orcid !== params.orcid) return { redirect: { destination: `/r/${orcid}`, permanent: true } };
  const profile = await getProfile(orcid, viewer ? viewer.id : null);
  if (!profile) return { notFound: true };
  if (profile.suspended_at && !(viewer && viewer.isAdmin)) return { notFound: true };
  const [works, feed] = await Promise.all([getWorks(profile.id), userPosts(viewer ? viewer.id : null, profile.id, null)]);
  return { props: { profile, works, posts: feed.posts, nextCursor: feed.nextCursor } };
});
