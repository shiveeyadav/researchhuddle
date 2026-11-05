// Server-only weekly email digest (opt-in). Run via scripts/send-digest.js or POST /api/cron/digest.
const { query } = require('./db');
const { sendMail } = require('./mailer');
const { appUrl } = require('./config');
const { hmac, safeEqual } = require('./session');
const { truncate, displayName } = require('./format');

function unsubscribeToken(userId) {
  return hmac(`digest-unsubscribe:${userId}`);
}

function verifyUnsubscribeToken(userId, token) {
  return typeof token === 'string' && safeEqual(unsubscribeToken(userId), token);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function buildDigest(user) {
  const { rows: posts } = await query(
    `SELECT p.id::text AS id, p.body, u.name AS author_name, u.orcid AS author_orcid,
            (SELECT count(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count
       FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.parent_id IS NULL AND p.hidden_at IS NULL AND u.suspended_at IS NULL
        AND p.created_at > now() - interval '7 days'
        AND p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = $1::bigint)
      ORDER BY like_count DESC, p.id DESC LIMIT 10`,
    [user.id]
  );
  const { rows: stats } = await query(
    `SELECT
       (SELECT count(*)::int FROM follows WHERE followee_id = $1::bigint AND created_at > now() - interval '7 days') AS new_followers,
       (SELECT count(*)::int FROM notifications WHERE user_id = $1::bigint AND read_at IS NULL) AS unread`,
    [user.id]
  );
  return { posts, newFollowers: stats[0].new_followers, unread: stats[0].unread };
}

function renderDigest(user, d) {
  const base = appUrl();
  const unsub = `${base}/unsubscribe?u=${encodeURIComponent(user.id)}&t=${unsubscribeToken(user.id)}`;
  const lines = [`Hello ${displayName(user)},`, '', 'Your weekly ResearchHuddle digest:', ''];
  if (d.newFollowers) lines.push(`- ${d.newFollowers} new follower(s) this week`);
  if (d.unread) lines.push(`- ${d.unread} unread notification(s): ${base}/notifications`);
  if (d.posts.length) {
    lines.push('', 'Top posts from researchers you follow:');
    for (const p of d.posts) {
      lines.push(`- ${displayName({ name: p.author_name, orcid: p.author_orcid })}: ${truncate(p.body, 140)}`);
      lines.push(`  ${base}/p/${p.id}`);
    }
  }
  lines.push('', `Turn off this email: ${unsub}`, `Or manage settings: ${base}/settings`);
  const text = lines.join('\n');

  const items = d.posts
    .map(
      (p) =>
        `<li style="margin-bottom:12px"><strong>${escapeHtml(displayName({ name: p.author_name, orcid: p.author_orcid }))}</strong>: ` +
        `${escapeHtml(truncate(p.body, 200))}<br><a href="${base}/p/${p.id}">Open post</a> · ${p.like_count} like(s)</li>`
    )
    .join('');
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#1d2433">` +
    `<h2 style="color:#0f5e66">ResearchHuddle weekly digest</h2>` +
    `<p>Hello ${escapeHtml(displayName(user))},</p>` +
    (d.newFollowers ? `<p>${d.newFollowers} new follower(s) this week.</p>` : '') +
    (d.unread ? `<p><a href="${base}/notifications">${d.unread} unread notification(s)</a></p>` : '') +
    (items ? `<h3>Top posts from researchers you follow</h3><ul style="padding-left:18px">${items}</ul>` : '') +
    `<p style="font-size:12px;color:#667"><a href="${unsub}">Unsubscribe from the digest</a> · ` +
    `<a href="${base}/settings">Settings</a></p></div>`;

  return { subject: 'Your weekly ResearchHuddle digest', text, html };
}

async function runDigest({ limit = 500 } = {}) {
  const { rows: users } = await query(
    `SELECT id::text AS id, orcid, name, email FROM users
      WHERE digest_opt_in AND email IS NOT NULL AND suspended_at IS NULL
        AND (last_digest_at IS NULL OR last_digest_at < now() - interval '6 days 12 hours')
      ORDER BY id LIMIT $1`,
    [limit]
  );
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const user of users) {
    try {
      const d = await buildDigest(user);
      if (d.posts.length || d.newFollowers || d.unread) {
        const msg = renderDigest(user, d);
        await sendMail({ to: user.email, ...msg });
        sent++;
      } else {
        skipped++;
      }
      await query('UPDATE users SET last_digest_at = now() WHERE id = $1::bigint', [user.id]);
    } catch (err) {
      failed++;
      console.error(`[digest] user ${user.id} failed:`, err.message);
    }
  }
  return { candidates: users.length, sent, skipped, failed };
}

module.exports = { runDigest, unsubscribeToken, verifyUnsubscribeToken };
