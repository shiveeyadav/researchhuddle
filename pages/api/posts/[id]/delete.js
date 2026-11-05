import { api, HttpError, parseId } from '../../../../lib/http';
import { query } from '../../../../lib/db';

// POST /api/posts/:id/delete  - authors delete their own posts (replies are removed with it).
export default api(
  {
    POST: async (req, res, { user }) => {
      const postId = parseId(req.query.id);
      const { rowCount } = await query('DELETE FROM posts WHERE id = $1 AND user_id = $2', [postId, user.id]);
      if (!rowCount) throw new HttpError(404, 'Post not found or not yours.');
      return res.status(200).json({ ok: true });
    },
  },
  { auth: true }
);
