import { exchangeCode, importRecord } from '../../../../lib/orcid';
import { query } from '../../../../lib/db';
import {
  appendSetCookie,
  createSession,
  parseCookies,
  safeEqual,
  serializeCookie,
} from '../../../../lib/session';

const STATE_COOKIE = 'rh_oauth_state';

function fail(res, code) {
  res.redirect(302, `/?auth_error=${encodeURIComponent(code)}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');

  const expectedState = parseCookies(req)[STATE_COOKIE];
  // One-time use: clear the state cookie whatever happens next.
  appendSetCookie(res, serializeCookie(STATE_COOKIE, '', { path: '/api/auth/orcid', maxAge: 0 }));

  const { code, state, error } = req.query;
  if (error) return fail(res, error === 'access_denied' ? 'denied' : 'orcid_error');
  if (typeof code !== 'string' || typeof state !== 'string' || !code || code.length > 200) {
    return fail(res, 'missing_code');
  }
  if (!expectedState || !safeEqual(expectedState, state)) return fail(res, 'state_mismatch');

  try {
    const { orcid, name } = await exchangeCode(code);

    const { rows } = await query(
      `INSERT INTO users (orcid, name, last_login_at)
       VALUES ($1, $2, now())
       ON CONFLICT (orcid) DO UPDATE
         SET last_login_at = now(), name = COALESCE(users.name, EXCLUDED.name)
       RETURNING id, suspended_at, last_import_at, (xmax = 0) AS inserted`,
      [orcid, name]
    );
    const user = rows[0];
    if (user.suspended_at) return fail(res, 'suspended');

    if (!user.last_import_at) {
      try {
        await importRecord(user.id, orcid);
      } catch (err) {
        console.error('[auth] ORCID record import failed:', err.message);
        await query('UPDATE users SET import_error = $2 WHERE id = $1', [user.id, String(err.message).slice(0, 500)]);
      }
    }

    await query('DELETE FROM sessions WHERE expires_at < now()');
    await createSession(res, user.id);
    return res.redirect(302, user.inserted ? '/settings?welcome=1' : '/');
  } catch (err) {
    console.error('[auth] ORCID callback failed:', err.message);
    return fail(res, 'login_failed');
  }
}
