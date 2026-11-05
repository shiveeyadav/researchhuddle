import crypto from 'crypto';
import { authorizeUrl } from '../../../../lib/orcid';
import { appendSetCookie, serializeCookie } from '../../../../lib/session';

const STATE_COOKIE = 'rh_oauth_state';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ORCID_CLIENT_ID) {
    return res.status(500).send('ORCID_CLIENT_ID is not configured on the server.');
  }
  const state = crypto.randomBytes(24).toString('base64url');
  // Scoped to the callback path, 10 minute lifetime, httpOnly + SameSite=Lax (sent on ORCID's top-level redirect back).
  appendSetCookie(res, serializeCookie(STATE_COOKIE, state, { path: '/api/auth/orcid', maxAge: 600 }));
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, authorizeUrl(state));
}
