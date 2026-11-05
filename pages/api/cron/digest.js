import { api, HttpError } from '../../../lib/http';
import { safeEqual } from '../../../lib/session';
import { runDigest } from '../../../lib/digest';

// POST /api/cron/digest with header "Authorization: Bearer $CRON_SECRET".
// Safe to call more often than weekly: each user receives at most one digest per ~7 days.
export default api(
  {
    POST: async (req, res) => {
      const secret = process.env.CRON_SECRET;
      const header = String(req.headers.authorization || '');
      if (!secret || secret.length < 16 || !safeEqual(header, `Bearer ${secret}`)) {
        throw new HttpError(401, 'Unauthorized');
      }
      const result = await runDigest();
      return res.status(200).json({ ok: true, ...result });
    },
  },
  { skipOriginCheck: true, public: true }
);
