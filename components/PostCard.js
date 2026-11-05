import Link from 'next/link';
import { useState } from 'react';
import Avatar from './Avatar';
import { useApp } from './AppContext';
import { postJson } from '../lib/clientApi';
import { formatDateTime, displayName } from '../lib/format';
import { splitTags } from '../lib/tags';
import { doiUrl } from '../lib/validate';
import { FIELD_LABELS } from '../lib/fields';

function Body({ text }) {
  return (
    <p className="post-body">
      {splitTags(text).map((part, i) =>
        part.type === 'tag' ? (
          <Link key={i} href={`/t/${part.tag}`} className="hashtag">
            {part.value}
          </Link>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </p>
  );
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {
    return url;
  }
}

/**
 * props: post (from lib/queries POST_SELECT), linkToPost (bool), onRemoved(id)
 */
export default function PostCard({ post, linkToPost = true, onRemoved }) {
  const { viewer } = useApp();
  const [liked, setLiked] = useState(!!post.liked);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [hidden, setHidden] = useState(!!post.hidden_at);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const author = displayName({ name: post.author_name, orcid: post.author_orcid });

  async function toggleLike() {
    if (!viewer) {
      window.location.href = '/api/auth/orcid/login';
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      const r = await postJson(`/api/posts/${post.id}/like`, { like: next });
      setLikeCount(r.likeCount);
    } catch (e) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    const reason = window.prompt('Why are you reporting this post? (e.g. spam, harassment, misinformation)');
    if (!reason) return;
    try {
      await postJson(`/api/posts/${post.id}/report`, { reason });
      setMsg('Thanks - a moderator will review this post.');
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this post? Replies to it will also be removed.')) return;
    try {
      await postJson(`/api/posts/${post.id}/delete`, {});
      if (onRemoved) onRemoved(post.id);
      else setMsg('Post deleted.');
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function moderate(hide) {
    const reason = hide ? window.prompt('Reason for hiding (optional):') || '' : '';
    try {
      await postJson(`/api/admin/posts/${post.id}`, { hidden: hide, reason });
      setHidden(hide);
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <article className={`post-card${hidden ? ' is-hidden' : ''}`}>
      <Link href={`/r/${post.author_orcid}`} className="post-avatar" aria-label={author}>
        <Avatar name={post.author_name} orcid={post.author_orcid} size={42} />
      </Link>
      <div className="post-main">
        <header className="post-head">
          <Link href={`/r/${post.author_orcid}`} className="post-author">
            {author}
          </Link>
          <span className="post-orcid muted">{post.author_orcid}</span>
          <span className="muted">·</span>
          {linkToPost ? (
            <Link href={`/p/${post.id}`} className="post-time muted">
              <time dateTime={post.created_at}>{formatDateTime(post.created_at)}</time>
            </Link>
          ) : (
            <time className="post-time muted" dateTime={post.created_at}>
              {formatDateTime(post.created_at)}
            </time>
          )}
        </header>
        {hidden ? <p className="notice small">Hidden by a moderator.</p> : null}
        {post.parent_id && linkToPost ? (
          <p className="small muted">
            Reply in <Link href={`/p/${post.parent_id}`}>thread</Link>
          </p>
        ) : null}
        <Body text={post.body} />
        {post.doi || post.link ? (
          <div className="post-refs">
            {post.doi ? (
              <a href={doiUrl(post.doi)} target="_blank" rel="noopener noreferrer nofollow ugc" className="ref doi">
                DOI: {post.doi}
              </a>
            ) : null}
            {post.link ? (
              <a href={post.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="ref">
                🔗 {hostOf(post.link)}
              </a>
            ) : null}
          </div>
        ) : null}
        {post.tags && post.tags.length ? (
          <div className="tag-row">
            {post.tags.map((t) => (
              <Link key={t} href={`/t/${t}`} className={`chip${t === post.field ? ' field' : ''}`}>
                {FIELD_LABELS[t] || `#${t}`}
              </Link>
            ))}
          </div>
        ) : null}
        <footer className="post-actions">
          <button type="button" className={`act${liked ? ' on' : ''}`} onClick={toggleLike} aria-pressed={liked}>
            {liked ? '♥' : '♡'} {likeCount}
          </button>
          {!post.parent_id ? (
            <Link href={`/p/${post.id}#reply`} className="act">
              💬 {post.reply_count || 0}
            </Link>
          ) : null}
          {viewer && post.is_own ? (
            <button type="button" className="act subtle" onClick={remove}>
              Delete
            </button>
          ) : null}
          {viewer && !post.is_own ? (
            <button type="button" className="act subtle" onClick={report}>
              Report
            </button>
          ) : null}
          {viewer && viewer.isAdmin ? (
            <button type="button" className="act subtle danger" onClick={() => moderate(!hidden)}>
              {hidden ? 'Unhide' : 'Hide'}
            </button>
          ) : null}
        </footer>
        {msg ? <p className="small muted" role="status">{msg}</p> : null}
      </div>
    </article>
  );
}
