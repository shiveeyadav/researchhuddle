import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Seo from '../components/Seo';
import { postJson } from '../lib/clientApi';
import { withViewer } from '../lib/serverProps';
import { query } from '../lib/db';
import { formatDateTime, truncate, displayName } from '../lib/format';

export default function AdminPage({ reports, hidden, suspended }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [orcid, setOrcid] = useState('');
  const [reason, setReason] = useState('');

  const reload = () => router.replace(router.asPath, undefined, { scroll: false });

  async function act(url, data, done) {
    setMsg('');
    try {
      await postJson(url, data);
      setMsg(done);
      reload();
    } catch (e) {
      setMsg(e.message);
    }
  }

  function suspend(e) {
    e.preventDefault();
    const id = orcid.trim().toUpperCase();
    if (!id) return;
    act(`/api/admin/users/${encodeURIComponent(id)}`, { suspended: true, reason }, `Suspended ${id}.`);
    setOrcid('');
    setReason('');
  }

  return (
    <>
      <Seo title="Moderation" noindex />
      <h1 className="page-title">Moderation</h1>
      {msg ? (
        <p className="card notice" role="status">
          {msg}
        </p>
      ) : null}

      <section className="card">
        <h2>Open reports ({reports.length})</h2>
        {!reports.length ? <p className="muted small">No open reports.</p> : null}
        <table className="table">
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/p/${r.post_id}`}>“{truncate(r.post_body, 120)}”</Link>
                  <div className="small muted">
                    by <Link href={`/r/${r.author_orcid}`}>{displayName({ name: r.author_name, orcid: r.author_orcid })}</Link>
                    {r.post_hidden ? ' · already hidden' : ''}
                  </div>
                </td>
                <td className="small">
                  <strong>{r.reason}</strong>
                  <div className="muted">
                    reported by {r.reporter_orcid}, {formatDateTime(r.created_at)}
                  </div>
                </td>
                <td className="nowrap">
                  <button
                    type="button"
                    className="btn danger small"
                    onClick={() => act(`/api/admin/posts/${r.post_id}`, { hidden: true, reason: r.reason }, 'Post hidden.')}
                  >
                    Hide post
                  </button>{' '}
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => act(`/api/admin/reports/${r.id}`, {}, 'Report dismissed.')}
                  >
                    Dismiss
                  </button>{' '}
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      window.confirm(`Suspend ${r.author_orcid}?`) &&
                      act(`/api/admin/users/${r.author_orcid}`, { suspended: true, reason: r.reason }, 'User suspended.')
                    }
                  >
                    Suspend author
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Suspend a user</h2>
        <form onSubmit={suspend} className="inline-row">
          <input value={orcid} onChange={(e) => setOrcid(e.target.value)} placeholder="0000-0000-0000-0000" maxLength={19} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (internal)" maxLength={500} />
          <button type="submit" className="btn danger">
            Suspend
          </button>
        </form>
        <h3>Suspended users ({suspended.length})</h3>
        <ul className="plain">
          {suspended.map((u) => (
            <li key={u.orcid}>
              <Link href={`/r/${u.orcid}`}>{displayName(u)}</Link> <span className="muted small">{u.orcid}</span>{' '}
              <span className="small">{u.suspended_reason}</span>{' '}
              <button
                type="button"
                className="btn ghost small"
                onClick={() => act(`/api/admin/users/${u.orcid}`, { suspended: false }, 'User reinstated.')}
              >
                Reinstate
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Recently hidden posts</h2>
        <ul className="plain">
          {hidden.map((p) => (
            <li key={p.id}>
              <Link href={`/p/${p.id}`}>“{truncate(p.body, 100)}”</Link>{' '}
              <span className="small muted">
                {p.author_orcid} · hidden {formatDateTime(p.hidden_at)} {p.hidden_reason ? `· ${p.hidden_reason}` : ''}
              </span>{' '}
              <button
                type="button"
                className="btn ghost small"
                onClick={() => act(`/api/admin/posts/${p.id}`, { hidden: false }, 'Post restored.')}
              >
                Unhide
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export const getServerSideProps = withViewer(async (ctx, viewer) => {
  if (!viewer) return { redirect: { destination: '/api/auth/orcid/login', permanent: false } };
  if (!viewer.isAdmin) return { notFound: true };
  const [reports, hidden, suspended] = await Promise.all([
    query(
      `SELECT r.id::text AS id, r.post_id::text AS post_id, r.reason, r.created_at,
              rep.orcid AS reporter_orcid, p.body AS post_body, (p.hidden_at IS NOT NULL) AS post_hidden,
              a.orcid AS author_orcid, a.name AS author_name
         FROM reports r
         JOIN posts p ON p.id = r.post_id
         JOIN users a ON a.id = p.user_id
         JOIN users rep ON rep.id = r.reporter_id
        WHERE r.resolved_at IS NULL
        ORDER BY r.created_at ASC LIMIT 200`
    ),
    query(
      `SELECT p.id::text AS id, p.body, p.hidden_at, p.hidden_reason, u.orcid AS author_orcid
         FROM posts p JOIN users u ON u.id = p.user_id
        WHERE p.hidden_at IS NOT NULL ORDER BY p.hidden_at DESC LIMIT 50`
    ),
    query(
      `SELECT orcid, name, suspended_at, suspended_reason FROM users
        WHERE suspended_at IS NOT NULL ORDER BY suspended_at DESC LIMIT 200`
    ),
  ]);
  const ser = (rows) => JSON.parse(JSON.stringify(rows));
  return { props: { reports: ser(reports.rows), hidden: ser(hidden.rows), suspended: ser(suspended.rows) } };
});
