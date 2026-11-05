import { api, HttpError } from '../../../lib/http';
import { query } from '../../../lib/db';
import { importRecord } from '../../../lib/orcid';

// POST /api/me/refresh - re-import the public ORCID record (max once per 2 minutes).
export default api(
  {
    POST: async (req, res, { user }) => {
      const { rows } = await query(
        `SELECT last_import_at > now() - interval '2 minutes' AS recent FROM users WHERE id = $1`,
        [user.id]
      );
      if (rows[0] && rows[0].recent) throw new HttpError(429, 'Your record was refreshed moments ago. Try again shortly.');
      try {
        const p = await importRecord(user.id, user.orcid);
        return res.status(200).json({ ok: true, works: p.works.length, affiliations: p.affiliations.length });
      } catch (err) {
        console.error('[refresh] import failed:', err.message);
        await query('UPDATE users SET import_error = $2 WHERE id = $1', [user.id, String(err.message).slice(0, 500)]);
        throw new HttpError(502, 'Could not reach ORCID right now. Please try again later.');
      }
    },
  },
  { auth: true }
);
