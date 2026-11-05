import { api, asBool, body, parseId, HttpError } from '../../../../lib/http';
import { query } from '../../../../lib/db';

// POST /api/admin/posts/:id { hidden: true|false, reason? } - hiding also resolves open reports.
export default api(
  {
    POST: async (req, res, { user }) => {
      const postId = parseId(req.query.id);
      const b = body(req);
      const hidden = asBool(b.hidden);
      const reason = String(b.reason || '').trim().slice(0, 500) || null;
      const { rowCount } = hidden
        ? await query(
            'UPDATE posts SET hidden_at = now(), hidden_by = $2, hidden_reason = $3 WHERE id = $1',
            [postId, user.id, reason]
          )
        : await query('UPDATE posts SET hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL WHERE id = $1', [postId]);
      if (!rowCount) throw new HttpError(404, 'Post not found.');
      if (hidden) {
        await query(
          'UPDATE reports SET resolved_at = now(), resolved_by = $2 WHERE post_id = $1 AND resolved_at IS NULL',
          [postId, user.id]
        );
      }
      return res.status(200).json({ ok: true, hidden });
    },
  },
  { admin: true }
);
