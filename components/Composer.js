import { useState } from 'react';
import { useRouter } from 'next/router';
import { postJson } from '../lib/clientApi';
import { charCount, MAX_POST_CHARS } from '../lib/validate';
import { FIELDS } from '../lib/fields';

/**
 * props: parentId (reply mode), placeholder, onPosted(id)
 */
export default function Composer({ parentId, placeholder, onPosted }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [doi, setDoi] = useState('');
  const [link, setLink] = useState('');
  const [field, setField] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const count = charCount(body);
  const over = count > MAX_POST_CHARS;
  const isReply = !!parentId;

  async function submit(e) {
    e.preventDefault();
    if (busy || !body.trim() || over) return;
    setBusy(true);
    setError('');
    try {
      const r = await postJson('/api/posts', {
        body,
        doi: doi || null,
        link: link || null,
        field: field || null,
        parentId: parentId || null,
      });
      setBody('');
      setDoi('');
      setLink('');
      setField('');
      setShowExtras(false);
      if (onPosted) onPosted(r.id);
      else router.replace(router.asPath, undefined, { scroll: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="composer card" onSubmit={submit} id={isReply ? 'reply' : undefined}>
      <label className="sr-only" htmlFor={isReply ? 'reply-body' : 'post-body'}>
        {isReply ? 'Your reply' : 'New post'}
      </label>
      <textarea
        id={isReply ? 'reply-body' : 'post-body'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder || (isReply ? 'Write a reply…' : 'Share a finding, a paper or a question. Use #hashtags.')}
        rows={isReply ? 3 : 4}
        maxLength={MAX_POST_CHARS * 2}
        required
      />
      {showExtras ? (
        <div className="composer-extras">
          <label>
            DOI <span className="muted small">(optional)</span>
            <input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.1234/abcd.5678" maxLength={250} />
          </label>
          <label>
            Link <span className="muted small">(optional)</span>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              maxLength={500}
            />
          </label>
          {!isReply ? (
            <label>
              Field <span className="muted small">(optional)</span>
              <select value={field} onChange={(e) => setField(e.target.value)}>
                <option value="">- none -</option>
                {FIELDS.map(([slug, label]) => (
                  <option key={slug} value={slug}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="composer-bar">
        <button type="button" className="btn ghost small" onClick={() => setShowExtras((v) => !v)}>
          {showExtras ? 'Hide DOI / link' : isReply ? '+ DOI / link' : '+ DOI / link / field'}
        </button>
        <span className={`counter${over ? ' over' : ''}`} aria-live="polite">
          {count}/{MAX_POST_CHARS}
        </span>
        <button type="submit" className="btn primary" disabled={busy || !body.trim() || over}>
          {busy ? 'Posting…' : isReply ? 'Reply' : 'Post'}
        </button>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
