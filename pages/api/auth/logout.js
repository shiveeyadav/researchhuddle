import { api } from '../../../lib/http';
import { destroySession } from '../../../lib/session';

export default api({
  POST: async (req, res) => {
    await destroySession(req, res);
    // Plain HTML form posts get a redirect; fetch() callers get JSON.
    if (String(req.headers.accept || '').includes('application/json')) return res.status(200).json({ ok: true });
    return res.redirect(303, '/');
  },
});
