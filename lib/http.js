// Server-only helpers for API routes.
const { appUrl } = require('./config');
const { getSessionUser } = require('./session');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch (_) {
    return null;
  }
}

// CSRF defence in depth (on top of SameSite=Lax cookies): mutations must come from our origin.
function isSameOrigin(req) {
  const expected = originOf(appUrl());
  const origin = req.headers.origin;
  if (origin) return origin === expected;
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';
  const referer = req.headers.referer;
  if (referer) return originOf(referer) === expected;
  return false;
}

/**
 * api({ GET: fn, POST: fn }, { auth, admin, skipOriginCheck })
 * fn(req, res, { user })
 */
function api(handlers, opts = {}) {
  return async function handler(req, res) {
    const fn = handlers[req.method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(handlers).join(', '));
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && !opts.skipOriginCheck && !isSameOrigin(req)) {
        return res.status(403).json({ error: 'Cross-site request blocked' });
      }
      const user = opts.public ? null : await getSessionUser(req);
      if ((opts.auth || opts.admin) && !user) {
        return res.status(401).json({ error: 'Please sign in with ORCID.' });
      }
      if (opts.admin && !user.is_admin) return res.status(403).json({ error: 'Admins only.' });
      res.setHeader('Cache-Control', 'no-store');
      return await fn(req, res, { user });
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      console.error('[api]', req.method, req.url, err);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
}

function body(req) {
  return req.body && typeof req.body === 'object' ? req.body : {};
}

function parseId(value) {
  const s = String(value || '');
  if (!/^\d{1,18}$/.test(s)) throw new HttpError(400, 'Invalid id');
  return s; // keep as string: BIGINT-safe
}

function asBool(v) {
  return v === true || v === 'true' || v === 'on' || v === '1' || v === 1;
}

module.exports = { HttpError, api, body, parseId, asBool, isSameOrigin };
