import { api, asBool, body, HttpError } from '../../../lib/http';
import { query } from '../../../lib/db';
import { normaliseEmail } from '../../../lib/validate';

// POST /api/me/settings { email, digestOptIn }
export default api(
  {
    POST: async (req, res, { user }) => {
      const b = body(req);
      const email = normaliseEmail(b.email);
      if (email === undefined) throw new HttpError(400, 'Please enter a valid email address (or leave it empty).');
      const digestOptIn = asBool(b.digestOptIn);
      if (digestOptIn && !email) throw new HttpError(400, 'Add an email address to receive the weekly digest.');
      await query('UPDATE users SET email = $2, digest_opt_in = $3 WHERE id = $1', [user.id, email, digestOptIn]);
      return res.status(200).json({ ok: true, email, digestOptIn });
    },
  },
  { auth: true }
);
