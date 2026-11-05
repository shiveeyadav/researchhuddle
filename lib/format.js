// Deterministic (UTC) formatting so server and client render identical markup.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${formatDate(iso)}, ${hh}:${mm} UTC`;
}

function initials(name, fallback) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return (fallback || '?').slice(0, 2).toUpperCase();
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function truncate(str, n) {
  const chars = Array.from(String(str || ''));
  return chars.length > n ? chars.slice(0, n - 1).join('') + '…' : chars.join('');
}

function displayName(user) {
  return (user && user.name) || (user && user.orcid) || 'Researcher';
}

module.exports = { formatDate, formatDateTime, initials, truncate, displayName };
