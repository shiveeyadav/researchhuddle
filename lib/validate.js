// Pure validation helpers (server is the source of truth; client uses them for hints).

const MAX_POST_CHARS = 1000;

function charCount(str) {
  return Array.from(String(str || '')).length; // code points, matches Postgres char_length
}

// Accepts "10.xxxx/yyy", "doi:10...", "https://doi.org/10..." and returns "10.xxxx/yyy" or null.
function normaliseDoi(input) {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  s = s.replace(/^doi:\s*/i, '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  try {
    if (/%[0-9a-f]{2}/i.test(s)) s = decodeURIComponent(s);
  } catch (_) {
    return null;
  }
  if (s.length > 200 || !/^10\.\d{4,9}\/\S+$/.test(s)) return null;
  return s;
}

function doiUrl(doi) {
  return 'https://doi.org/' + encodeURI(doi).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

function normaliseLink(input) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (s.length > 500) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString();
  } catch (_) {
    return null;
  }
}

function normaliseEmail(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  if (s.length > 254 || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s)) return undefined; // undefined = invalid
  return s;
}

module.exports = { MAX_POST_CHARS, charCount, normaliseDoi, doiUrl, normaliseLink, normaliseEmail };
