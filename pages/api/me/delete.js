import { api, body, HttpError } from '../../../lib/http';
import { query } from '../../../lib/db';
import { appendSetCookie, serializeCookie, SESSION_COOKIE } from '../../../lib/session';

// POST /api/me/delete { confirm: "<your ORCID iD>" } - erases the account and all its content.
export default api(
  {
    POST: async (req, res, { user }) => {
      const confirm = String(body(req).confirm || '').trim().toUpperCase();
      if (confirm !== user.orcid) throw new HttpError(400, 'Type your ORCID iD exactly to confirm.');
      await query('DELETE FROM users WHERE id = $1', [user.id]); // cascades to sessions, posts, likes, follows...
      appendSetCookie(res, serializeCookie(SESSION_COOKIE, '', { maxAge: 0 }));
      return res.status(200).json({ ok: true });
    },
  },
  { auth: true }
);
