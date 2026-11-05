import Seo from '../../components/Seo';
import Feed from '../../components/Feed';
import { useApp } from '../../components/AppContext';
import { withViewer } from '../../lib/serverProps';
import { tagFeed } from '../../lib/queries';
import { isValidTag } from '../../lib/tags';
import { FIELD_LABELS } from '../../lib/fields';

export default function TagPage({ tag, posts, nextCursor }) {
  const { site } = useApp();
  const label = FIELD_LABELS[tag] ? `${FIELD_LABELS[tag]} (#${tag})` : `#${tag}`;
  return (
    <>
      <Seo
        title={`${label} - posts`}
        description={`Posts from verified researchers tagged ${label} on ResearchHuddle.`}
        canonical={`${site.appUrl}/t/${tag}`}
        noindex={!posts.length}
      />
      <div className="narrow">
        <h1 className="page-title">{label}</h1>
        <Feed
          initialPosts={posts}
          initialCursor={nextCursor}
          query={{ tag }}
          emptyText="No posts with this tag yet."
        />
      </div>
    </>
  );
}

export const getServerSideProps = withViewer(async ({ params }, viewer) => {
  const raw = String(params.tag || '');
  const tag = raw.toLowerCase();
  if (!isValidTag(tag)) return { notFound: true };
  if (tag !== raw) return { redirect: { destination: `/t/${tag}`, permanent: true } };
  const feed = await tagFeed(viewer ? viewer.id : null, tag, null);
  return { props: { tag, posts: feed.posts, nextCursor: feed.nextCursor } };
});
