// Displays an authenticated ORCID iD per ORCID's display guidelines (green iD icon + full https URL).
export function OrcidIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false">
      <circle cx="128" cy="128" r="128" fill="#A6CE39" />
      <rect x="70" y="80" width="18" height="110" fill="#fff" />
      <circle cx="79" cy="60" r="11" fill="#fff" />
      <path
        d="M108 80h40c38 0 58 26 58 55s-21 55-58 55h-40zm18 16v78h22c28 0 40-18 40-39s-13-39-40-39z"
        fill="#fff"
      />
    </svg>
  );
}

export default function OrcidBadge({ orcid, orcidBase, verified = true, compact = false }) {
  const base = orcidBase || 'https://orcid.org';
  const url = `${base}/${orcid}`;
  return (
    <span className={`orcid-badge${compact ? ' compact' : ''}`}>
      <a href={url} target="_blank" rel="noopener noreferrer" title="View ORCID record">
        <OrcidIcon size={compact ? 14 : 18} />
        <span className="orcid-url">{compact ? orcid : url}</span>
      </a>
      {verified && !compact ? (
        <span className="verified" title="This iD was authenticated when the researcher signed in with ORCID">
          ✓ Verified via ORCID sign-in
        </span>
      ) : null}
    </span>
  );
}
