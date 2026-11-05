import { api } from '../../../lib/http';
import { query } from '../../../lib/db';

// POST /api/notifications/read - marks all notifications as read.
export default api(
  {
    POST: async (req, res, { user }) => {
      await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [user.id]);
      return res.status(200).json({ ok: true });
    },
  },
  { auth: true }
);
