import { api, asBool, body, HttpError } from '../../../../lib/http';
import { query } from '../../../../lib/db';
import { isValidOrcid, normaliseOrcid } from '../../../../lib/orcid-id';
import { isAdminOrcid } from '../../../../lib/config';

// POST /api/admin/users/:orcid { suspended: true|false, reason? }
export default api(
  {
    POST: async (req, res) => {
      const orcid = normaliseOrcid(req.query.orcid);
      if (!isValidOrcid(orcid)) throw new HttpError(400, 'Invalid ORCID iD.');
      if (isAdminOrcid(orcid)) throw new HttpError(400, 'Admins cannot be suspended here (remove from ADMIN_ORCIDS first).');
      const b = body(req);
      const suspended = asBool(b.suspended);
      const reason = String(b.reason || '').trim().slice(0, 500) || null;
      const { rows } = suspended
        ? await query(
            'UPDATE users SET suspended_at = now(), suspended_reason = $2 WHERE orcid = $1 RETURNING id',
            [orcid, reason]
          )
        : await query(
            'UPDATE users SET suspended_at = NULL, suspended_reason = NULL WHERE orcid = $1 RETURNING id',
            [orcid]
          );
      if (!rows[0]) throw new HttpError(404, 'No ResearchHuddle account with that ORCID iD.');
      if (suspended) await query('DELETE FROM sessions WHERE user_id = $1', [rows[0].id]);
      return res.status(200).json({ ok: true, suspended });
    },
  },
  { admin: true }
);
