import { api, asBool, body, HttpError } from '../../lib/http';
import { query } from '../../lib/db';
import { isValidOrcid, normaliseOrcid } from '../../lib/orcid-id';
import { notify } from '../../lib/queries';

// POST /api/follow { orcid, follow: true|false }
export default api(
  {
    POST: async (req, res, { user }) => {
      const b = body(req);
      const orcid = normaliseOrcid(b.orcid);
      if (!isValidOrcid(orcid)) throw new HttpError(400, 'Invalid ORCID iD.');
      const follow = asBool(b.follow);

      const { rows } = await query('SELECT id FROM users WHERE orcid = $1 AND suspended_at IS NULL', [orcid]);
      if (!rows[0]) throw new HttpError(404, 'Researcher not found.');
      const targetId = rows[0].id;
      if (String(targetId) === String(user.id)) throw new HttpError(400, 'You cannot follow yourself.');

      if (follow) {
        const ins = await query(
          'INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.id, targetId]
        );
        if (ins.rowCount) await notify(targetId, user.id, 'follow', null);
      } else {
        await query('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2', [user.id, targetId]);
      }
      const { rows: c } = await query('SELECT count(*)::int AS n FROM follows WHERE followee_id = $1', [targetId]);
      return res.status(200).json({ ok: true, following: follow, followerCount: c[0].n });
    },
  },
  { auth: true }
);
