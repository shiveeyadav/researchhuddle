import { api, parseId, HttpError } from '../../../../lib/http';
import { query } from '../../../../lib/db';

// POST /api/admin/reports/:id - dismiss (resolve) a report without hiding the post.
export default api(
  {
    POST: async (req, res, { user }) => {
      const id = parseId(req.query.id);
      const { rowCount } = await query(
        'UPDATE reports SET resolved_at = now(), resolved_by = $2 WHERE id = $1 AND resolved_at IS NULL',
        [id, user.id]
      );
      if (!rowCount) throw new HttpError(404, 'Report not found or already resolved.');
      return res.status(200).json({ ok: true });
    },
  },
  { admin: true }
);
