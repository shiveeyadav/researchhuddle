import { api, asBool, body, HttpError, parseId } from '../../../../lib/http';
import { query } from '../../../../lib/db';
import { notify } from '../../../../lib/queries';

// POST /api/posts/:id/like { like: true|false }
export default api(
  {
    POST: async (req, res, { user }) => {
      const postId = parseId(req.query.id);
      const like = asBool(body(req).like);
      const { rows } = await query(
        `SELECT p.user_id FROM posts p JOIN users u ON u.id = p.user_id
          WHERE p.id = $1 AND p.hidden_at IS NULL AND u.suspended_at IS NULL`,
        [postId]
      );
      if (!rows[0]) throw new HttpError(404, 'Post not found.');

      if (like) {
        const ins = await query(
          'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.id, postId]
        );
        if (ins.rowCount) await notify(rows[0].user_id, user.id, 'like', postId);
      } else {
        await query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [user.id, postId]);
      }
      const { rows: c } = await query('SELECT count(*)::int AS n FROM likes WHERE post_id = $1', [postId]);
      return res.status(200).json({ ok: true, liked: like, likeCount: c[0].n });
    },
  },
  { auth: true }
);
