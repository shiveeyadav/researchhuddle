import Link from 'next/link';
import { useState } from 'react';
import Seo from '../components/Seo';
import OrcidBadge from '../components/OrcidBadge';
import { useApp } from '../components/AppContext';
import { postJson } from '../lib/clientApi';
import { withViewer } from '../lib/serverProps';
import { query } from '../lib/db';
import { formatDateTime } from '../lib/format';

export default function SettingsPage({ me, welcome }) {
  const { site } = useApp();
  const [email, setEmail] = useState(me.email || '');
  const [digest, setDigest] = useState(!!me.digest_opt_in);
  const [saveMsg, setSaveMsg] = useState('');
  const [refreshMsg, setRefreshMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSaveMsg('');
    try {
      await postJson('/api/me/settings', { email, digestOptIn: digest });
      setSaveMsg('Saved.');
    } catch (err) {
      setSaveMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setRefreshMsg('Refreshing…');
    try {
      const r = await postJson('/api/me/refresh', {});
      setRefreshMsg(`Done: ${r.works} works and ${r.affiliations} affiliations imported.`);
    } catch (err) {
      setRefreshMsg(err.message);
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    if (!window.confirm('Permanently delete your ResearchHuddle account and all your posts? This cannot be undone.')) return;
    try {
      await postJson('/api/me/delete', { confirm });
      window.location.href = '/';
    } catch (err) {
      setDeleteMsg(err.message);
    }
  }

  return (
    <>
      <Seo title="Settings" noindex />
      <div className="narrow">
        <h1 className="page-title">Settings</h1>
        {welcome ? (
          <div className="card notice">
            <strong>Welcome to ResearchHuddle!</strong> We imported your public ORCID record.{' '}
            <Link href={`/r/${me.orcid}`}>View your profile</Link>, or <Link href="/search">find colleagues to follow</Link>.
          </div>
        ) : null}

        <section className="card">
          <h2>ORCID record</h2>
          <OrcidBadge orcid={me.orcid} orcidBase={site.orcidBase} />
          <p className="small muted">
            {me.last_import_at ? `Last imported ${formatDateTime(me.last_import_at)}.` : 'Not imported yet.'}{' '}
            Your name, biography, keywords, affiliations and works are copied from your <em>public</em> ORCID record.
            To change them, edit your record at ORCID, then refresh here.
          </p>
          {me.import_error ? <p className="error small">Last import problem: {me.import_error}</p> : null}
          <button type="button" className="btn ghost" onClick={refresh}>
            ↻ Refresh from ORCID
          </button>
          {refreshMsg ? <p className="small" role="status">{refreshMsg}</p> : null}
        </section>

        <section className="card">
          <h2>Email digest</h2>
          <form onSubmit={save} className="stack">
            <label>
              Email address <span className="muted small">(optional, only used for the digest)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
            </label>
            <label className="check">
              <input type="checkbox" checked={digest} onChange={(e) => setDigest(e.target.checked)} />
              Send me a weekly digest of popular posts from people I follow (off by default).
            </label>
            <div>
              <button type="submit" className="btn primary" disabled={busy}>
                Save
              </button>{' '}
              {saveMsg ? <span className="small" role="status">{saveMsg}</span> : null}
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Your data</h2>
          <p className="small">
            Download a copy of everything we hold about you (UK GDPR right of access / portability).
          </p>
          <a href="/api/me/export" className="btn ghost">
            Download my data (JSON)
          </a>
        </section>

        <section className="card danger-zone">
          <h2>Delete account</h2>
          <p className="small">
            This permanently erases your profile, posts, replies, likes, follows and notifications. Type your ORCID iD (
            <code>{me.orcid}</code>) to confirm.
          </p>
          <form onSubmit={deleteAccount} className="inline-row">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={me.orcid} maxLength={19} />
            <button type="submit" className="btn danger" disabled={confirm.trim().toUpperCase() !== me.orcid}>
              Delete my account
            </button>
          </form>
          {deleteMsg ? <p className="error small">{deleteMsg}</p> : null}
        </section>
      </div>
    </>
  );
}

export const getServerSideProps = withViewer(async ({ query: q }, viewer) => {
  if (!viewer) return { redirect: { destination: '/api/auth/orcid/login', permanent: false } };
  const { rows } = await query(
    `SELECT orcid, email, digest_opt_in, last_import_at, import_error FROM users WHERE id = $1`,
    [viewer.id]
  );
  const me = JSON.parse(JSON.stringify(rows[0]));
  return { props: { me, welcome: q.welcome === '1' } };
});
