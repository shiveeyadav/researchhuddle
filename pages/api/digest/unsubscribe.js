import { api, body, HttpError } from '../../../lib/http';
import { query } from '../../../lib/db';
import { verifyUnsubscribeToken } from '../../../lib/digest';

// POST /api/digest/unsubscribe { u, t } - one-click opt-out from the email link (no login needed).
export default api(
  {
    POST: async (req, res) => {
      const b = body(req);
      const u = String(b.u || '');
      if (!/^\d{1,18}$/.test(u) || !verifyUnsubscribeToken(u, String(b.t || ''))) {
        throw new HttpError(400, 'This unsubscribe link is invalid.');
      }
      await query('UPDATE users SET digest_opt_in = FALSE WHERE id = $1', [u]);
      return res.status(200).json({ ok: true });
    },
  },
  { public: true }
);
