// Server-only: cookie + sessions-table based authentication.
const crypto = require('crypto');
const { query } = require('./db');
const { isSecureApp, isAdminOrcid } = require('./config');

const SESSION_COOKIE = 'rh_session';
const SESSION_DAYS = 30;

function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set to at least 32 characters');
    }
    return 'dev-only-insecure-session-secret-change-me';
  }
  return s;
}

function hmac(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(String(value)).digest('hex');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function parseCookies(req) {
  const header = (req && req.headers && req.headers.cookie) || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const key = pair.slice(0, idx).trim();
    if (!key || key in out) return;
    try {
      out[key] = decodeURIComponent(pair.slice(idx + 1).trim());
    } catch (_) {
      out[key] = pair.slice(idx + 1).trim();
    }
  });
  return out;
}

function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  if (isSecureApp()) parts.push('Secure');
  return parts.join('; ');
}

function appendSetCookie(res, cookie) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', [cookie]);
  else res.setHeader('Set-Cookie', (Array.isArray(prev) ? prev : [String(prev)]).concat(cookie));
}

async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hmac(token), userId, SESSION_DAYS]
  );
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400 }));
}

// Returns the signed-in, non-suspended user (with is_admin) or null. Cached per request.
async function getSessionUser(req) {
  if (req.__rhUser !== undefined) return req.__rhUser;
  const token = parseCookies(req)[SESSION_COOKIE];
  let user = null;
  if (token && token.length >= 20 && token.length <= 100) {
    const { rows } = await query(
      `SELECT u.id, u.orcid, u.name, u.email, u.digest_opt_in, u.last_import_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND u.suspended_at IS NULL`,
      [hmac(token)]
    );
    if (rows[0]) user = { ...rows[0], is_admin: isAdminOrcid(rows[0].orcid) };
  }
  req.__rhUser = user;
  return user;
}

async function destroySession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hmac(token)]);
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, '', { maxAge: 0 }));
}

module.exports = {
  SESSION_COOKIE,
  hmac,
  safeEqual,
  parseCookies,
  serializeCookie,
  appendSetCookie,
  createSession,
  getSessionUser,
  destroySession,
};
