import Link from 'next/link';
import { useRouter } from 'next/router';
import Seo from '../../components/Seo';
import PostCard from '../../components/PostCard';
import Composer from '../../components/Composer';
import { useApp } from '../../components/AppContext';
import { withViewer } from '../../lib/serverProps';
import { getPost, getReplies } from '../../lib/queries';
import { truncate, displayName } from '../../lib/format';

export default function PostPage({ post, replies, parent }) {
  const { viewer, site } = useApp();
  const router = useRouter();
  const author = displayName({ name: post.author_name, orcid: post.author_orcid });
  const canonical = `${site.appUrl}/p/${post.id}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    headline: truncate(post.body, 110),
    datePublished: post.created_at,
    url: canonical,
    author: { '@type': 'Person', name: author, identifier: `${site.orcidBase}/${post.author_orcid}` },
  };

  return (
    <>
      <Seo
        title={`${author}: "${truncate(post.body, 60)}"`}
        description={truncate(post.body, 160)}
        canonical={canonical}
        type="article"
        noindex={!!post.hidden_at}
        jsonLd={post.hidden_at ? null : jsonLd}
      />
      <div className="narrow">
        <p className="small">
          <Link href="/">← Back to feed</Link>
        </p>
        {parent ? (
          <div className="parent-context">
            <PostCard post={parent} />
          </div>
        ) : null}
        <PostCard post={post} linkToPost={false} onRemoved={() => router.push('/')} />
        {!post.parent_id ? (
          <section className="replies">
            <h2 className="section-title">Replies ({replies.length})</h2>
            {viewer ? (
              <Composer parentId={post.id} />
            ) : (
              <p className="card small">
                <a href="/api/auth/orcid/login">Sign in with ORCID</a> to reply.
              </p>
            )}
            {replies.map((r) => (
              <PostCard key={r.id} post={r} onRemoved={() => router.replace(router.asPath)} />
            ))}
          </section>
        ) : null}
      </div>
    </>
  );
}

export const getServerSideProps = withViewer(async ({ params }, viewer) => {
  const id = String(params.id || '');
  if (!/^\d{1,18}$/.test(id)) return { notFound: true };
  const isAdmin = !!(viewer && viewer.isAdmin);
  const post = await getPost(viewer ? viewer.id : null, id, isAdmin);
  if (!post) return { notFound: true };
  const replies = post.parent_id ? [] : await getReplies(viewer ? viewer.id : null, id);
  const parent = post.parent_id ? await getPost(viewer ? viewer.id : null, post.parent_id, isAdmin) : null;
  return { props: { post, replies, parent } };
});
