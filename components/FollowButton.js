import { useState } from 'react';
import { useApp } from './AppContext';
import { postJson } from '../lib/clientApi';

export default function FollowButton({ orcid, initialFollowing, onChange }) {
  const { viewer } = useApp();
  const [following, setFollowing] = useState(!!initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (viewer && viewer.orcid === orcid) return null;

  async function toggle() {
    if (!viewer) {
      window.location.href = '/api/auth/orcid/login';
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await postJson('/api/follow', { orcid, follow: !following });
      setFollowing(r.following);
      if (onChange) onChange(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="follow-wrap">
      <button type="button" className={`btn ${following ? 'ghost' : 'primary'}`} onClick={toggle} disabled={busy}>
        {following ? 'Following' : 'Follow'}
      </button>
      {error ? <span className="error small">{error}</span> : null}
    </span>
  );
}
