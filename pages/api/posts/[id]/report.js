import { api, body, HttpError, parseId } from '../../../../lib/http';
import { query } from '../../../../lib/db';

const REPORTS_PER_DAY = 20;

// POST /api/posts/:id/report { reason }
export default api(
  {
    POST: async (req, res, { user }) => {
      const postId = parseId(req.query.id);
      const reason = String(body(req).reason || '').trim();
      if (reason.length < 3) throw new HttpError(400, 'Please give a short reason.');
      if (reason.length > 500) throw new HttpError(400, 'Reason is limited to 500 characters.');

      const { rows } = await query('SELECT user_id FROM posts WHERE id = $1', [postId]);
      if (!rows[0]) throw new HttpError(404, 'Post not found.');
      if (String(rows[0].user_id) === String(user.id)) throw new HttpError(400, 'You cannot report your own post.');

      const { rows: rate } = await query(
        `SELECT count(*)::int AS n FROM reports WHERE reporter_id = $1 AND created_at > now() - interval '1 day'`,
        [user.id]
      );
      if (rate[0].n >= REPORTS_PER_DAY) throw new HttpError(429, 'Report limit reached for today.');

      await query(
        `INSERT INTO reports (post_id, reporter_id, reason) VALUES ($1, $2, $3)
         ON CONFLICT (post_id, reporter_id) DO UPDATE SET reason = EXCLUDED.reason, resolved_at = NULL, resolved_by = NULL`,
        [postId, user.id, reason]
      );
      return res.status(200).json({ ok: true });
    },
  },
  { auth: true }
);
