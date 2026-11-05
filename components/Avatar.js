import { initials } from '../lib/format';

// Deterministic coloured initials avatar (no uploads in the MVP).
const HUES = [168, 190, 210, 230, 262, 300, 330, 20, 40, 140];

function hueFor(key) {
  let h = 0;
  const s = String(key || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export default function Avatar({ name, orcid, size = 40 }) {
  const hue = hueFor(orcid || name);
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: `hsl(${hue} 45% 88%)`,
        color: `hsl(${hue} 55% 28%)`,
      }}
    >
      {initials(name, orcid ? orcid.slice(-2) : '?')}
    </span>
  );
}
