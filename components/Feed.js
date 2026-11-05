import { useEffect, useState } from 'react';
import PostCard from './PostCard';
import { getJson } from '../lib/clientApi';

/**
 * Renders a list of posts with "Load more" (cursor pagination through GET /api/posts).
 * props: initialPosts, initialCursor, query ({feed} or {tag}) - omit query to disable loading more,
 *        emptyText
 */
export default function Feed({ initialPosts, initialCursor, query, emptyText }) {
  const [posts, setPosts] = useState(initialPosts || []);
  const [cursor, setCursor] = useState(initialCursor || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset when SSR props change (e.g. after posting or switching tabs).
  useEffect(() => {
    setPosts(initialPosts || []);
    setCursor(initialCursor || null);
  }, [initialPosts, initialCursor]);

  async function loadMore() {
    if (!cursor || loading || !query) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ ...query, before: cursor });
      const r = await getJson(`/api/posts?${params.toString()}`);
      setPosts((prev) => prev.concat(r.posts.filter((p) => !prev.some((x) => x.id === p.id))));
      setCursor(r.nextCursor);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!posts.length) return <p className="empty card">{emptyText || 'No posts yet.'}</p>;

  return (
    <div className="feed">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} onRemoved={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
      ))}
      {cursor && query ? (
        <div className="load-more">
          <button type="button" className="btn ghost" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
          {error ? <p className="error small">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
