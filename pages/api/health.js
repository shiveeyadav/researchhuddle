import { query } from '../../lib/db';

// GET /api/health - liveness + DB check for Shipvolta / uptime monitors.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await query('SELECT 1');
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(503).json({ ok: false, error: 'database unavailable' });
  }
}
