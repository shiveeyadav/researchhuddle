// Server-only data access used by getServerSideProps and API routes.
const { query } = require('./db');

const PAGE_SIZE = 20;

// $1 is always the viewer id (or NULL). Extra params start at $2.
const POST_SELECT = `
  SELECT p.id::text AS id, p.parent_id::text AS parent_id, p.body, p.doi, p.link, p.field,
         p.created_at, p.hidden_at,
         u.orcid AS author_orcid, u.name AS author_name,
         (SELECT count(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
         (SELECT count(*)::int FROM posts r WHERE r.parent_id = p.id AND r.hidden_at IS NULL) AS reply_count,
         COALESCE((SELECT array_agg(t.tag ORDER BY t.tag) FROM post_tags t WHERE t.post_id = p.id), '{}') AS tags,
         EXISTS (SELECT 1 FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = $1::bigint) AS liked,
         COALESCE(p.user_id = $1::bigint, FALSE) AS is_own
    FROM posts p
    JOIN users u ON u.id = p.user_id`;

const VISIBLE = 'p.hidden_at IS NULL AND u.suspended_at IS NULL';

function serialise(rows) {
  return JSON.parse(JSON.stringify(rows));
}

function cursorParam(before) {
  return before && /^\d{1,18}$/.test(String(before)) ? String(before) : null;
}

async function listPosts({ viewerId = null, where = [], params = [], before = null, limit = PAGE_SIZE }) {
  const all = [viewerId, ...params];
  const conds = [VISIBLE, ...where];
  const cursor = cursorParam(before);
  if (cursor) {
    all.push(cursor);
    conds.push(`p.id < $${all.length}::bigint`);
  }
  all.push(limit + 1);
  const sql = `${POST_SELECT} WHERE ${conds.join(' AND ')} ORDER BY p.id DESC LIMIT $${all.length}`;
  const { rows } = await query(sql, all);
  const hasMore = rows.length > limit;
  const posts = serialise(rows.slice(0, limit));
  return { posts, nextCursor: hasMore ? posts[posts.length - 1].id : null };
}

function latestFeed(viewerId, before) {
  return listPosts({ viewerId, where: ['p.parent_id IS NULL'], before });
}

function homeFeed(viewerId, before) {
  return listPosts({
    viewerId,
    where: [
      'p.parent_id IS NULL',
      '(p.user_id = $1::bigint OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = $1::bigint))',
    ],
    before,
  });
}

function tagFeed(viewerId, tag, before) {
  return listPosts({
    viewerId,
    where: ['EXISTS (SELECT 1 FROM post_tags t2 WHERE t2.post_id = p.id AND t2.tag = $2)'],
    params: [tag],
    before,
  });
}

function userPosts(viewerId, userId, before) {
  return listPosts({ viewerId, where: ['p.user_id = $2::bigint'], params: [userId], before });
}

// Single post; admins may see hidden posts.
async function getPost(viewerId, postId, includeHidden) {
  const cond = includeHidden ? 'TRUE' : VISIBLE;
  const { rows } = await query(`${POST_SELECT} WHERE p.id = $2::bigint AND ${cond}`, [viewerId, postId]);
  return rows[0] ? serialise(rows)[0] : null;
}

async function getReplies(viewerId, postId) {
  const { rows } = await query(
    `${POST_SELECT} WHERE p.parent_id = $2::bigint AND ${VISIBLE} ORDER BY p.id ASC LIMIT 200`,
    [viewerId, postId]
  );
  return serialise(rows);
}

async function getProfile(orcid, viewerId) {
  const { rows } = await query(
    `SELECT u.id::text AS id, u.orcid, u.name, u.biography, u.keywords, u.affiliations,
            u.last_import_at, u.created_at, u.suspended_at,
            (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id) AS follower_count,
            (SELECT count(*)::int FROM follows f WHERE f.follower_id = u.id) AS following_count,
            (SELECT count(*)::int FROM posts p WHERE p.user_id = u.id AND p.hidden_at IS NULL) AS post_count,
            EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2::bigint AND f.followee_id = u.id) AS is_following
       FROM users u WHERE u.orcid = $1`,
    [orcid, viewerId]
  );
  return rows[0] ? serialise(rows)[0] : null;
}

async function getWorks(userId) {
  const { rows } = await query(
    `SELECT id::text AS id, title, year, journal, doi, url, work_type
       FROM works WHERE user_id = $1::bigint
      ORDER BY year DESC NULLS LAST, title ASC LIMIT 500`,
    [userId]
  );
  return serialise(rows);
}

function escapeLike(s) {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}

async function searchResearchers(q) {
  const pattern = `%${escapeLike(q)}%`;
  const { rows } = await query(
    `SELECT u.orcid, u.name, u.biography, u.keywords, u.affiliation_text,
            (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id) AS follower_count
       FROM users u
      WHERE u.suspended_at IS NULL
        AND (u.name ILIKE $1
             OR u.orcid = upper($2)
             OR array_to_string(u.keywords, ' ') ILIKE $1
             OR u.affiliation_text ILIKE $1)
      ORDER BY (u.name ILIKE $1) DESC, follower_count DESC, u.name ASC NULLS LAST
      LIMIT 50`,
    [pattern, q]
  );
  return serialise(rows);
}

async function searchTags(q) {
  const pattern = `${escapeLike(q.toLowerCase().replace(/^#/, ''))}%`;
  const { rows } = await query(
    `SELECT t.tag, count(*)::int AS n
       FROM post_tags t JOIN posts p ON p.id = t.post_id
      WHERE t.tag LIKE $1 AND p.hidden_at IS NULL
      GROUP BY t.tag ORDER BY n DESC LIMIT 12`,
    [pattern]
  );
  return rows;
}

async function trendingTags(limit = 12) {
  const { rows } = await query(
    `SELECT t.tag, count(*)::int AS n
       FROM post_tags t JOIN posts p ON p.id = t.post_id
      WHERE p.created_at > now() - interval '14 days' AND p.hidden_at IS NULL
      GROUP BY t.tag ORDER BY n DESC, t.tag ASC LIMIT $1`,
    [limit]
  );
  return rows;
}

async function unreadCount(userId) {
  const { rows } = await query(
    'SELECT count(*)::int AS n FROM notifications WHERE user_id = $1::bigint AND read_at IS NULL',
    [userId]
  );
  return rows[0].n;
}

async function listNotifications(userId) {
  const { rows } = await query(
    `SELECT n.id::text AS id, n.type, n.created_at, n.read_at, n.post_id::text AS post_id,
            a.orcid AS actor_orcid, a.name AS actor_name,
            left(p.body, 140) AS post_excerpt, p.parent_id::text AS post_parent_id
       FROM notifications n
       JOIN users a ON a.id = n.actor_id
       LEFT JOIN posts p ON p.id = n.post_id
      WHERE n.user_id = $1::bigint AND a.suspended_at IS NULL
      ORDER BY n.id DESC LIMIT 100`,
    [userId]
  );
  return serialise(rows);
}

async function notify(recipientId, actorId, type, postId) {
  if (String(recipientId) === String(actorId)) return;
  await query(
    `INSERT INTO notifications (user_id, actor_id, type, post_id)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [recipientId, actorId, type, postId || null]
  );
}

module.exports = {
  PAGE_SIZE,
  serialise,
  listPosts,
  latestFeed,
  homeFeed,
  tagFeed,
  userPosts,
  getPost,
  getReplies,
  getProfile,
  getWorks,
  searchResearchers,
  searchTags,
  trendingTags,
  unreadCount,
  listNotifications,
  notify,
};
