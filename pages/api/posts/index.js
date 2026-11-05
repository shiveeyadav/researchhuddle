import { api, body, HttpError, parseId } from '../../../lib/http';
import { query, tx } from '../../../lib/db';
import { charCount, MAX_POST_CHARS, normaliseDoi, normaliseLink } from '../../../lib/validate';
import { extractTags, isValidTag } from '../../../lib/tags';
import { isField } from '../../../lib/fields';
import { latestFeed, homeFeed, tagFeed, userPosts, notify } from '../../../lib/queries';
import { isValidOrcid, normaliseOrcid } from '../../../lib/orcid-id';

const POSTS_PER_HOUR = 30;

export default api({
  // GET /api/posts?feed=latest|home | tag=x | author=orcid, &before=id  (JSON pagination)
  GET: async (req, res, { user }) => {
    const { feed, tag, author, before } = req.query;
    let result;
    if (typeof author === 'string' && author) {
      const orcid = normaliseOrcid(author);
      if (!isValidOrcid(orcid)) throw new HttpError(400, 'Invalid ORCID iD');
      const { rows } = await query('SELECT id FROM users WHERE orcid = $1 AND suspended_at IS NULL', [orcid]);
      if (!rows[0]) throw new HttpError(404, 'Researcher not found');
      result = await userPosts(user ? user.id : null, rows[0].id, before);
    } else if (typeof tag === 'string' && tag) {
      if (!isValidTag(tag)) throw new HttpError(400, 'Invalid tag');
      result = await tagFeed(user ? user.id : null, tag, before);
    } else if (feed === 'home') {
      if (!user) throw new HttpError(401, 'Please sign in with ORCID.');
      result = await homeFeed(user.id, before);
    } else {
      result = await latestFeed(user ? user.id : null, before);
    }
    return res.status(200).json(result);
  },

  // POST /api/posts { body, doi?, link?, field?, parentId? }
  POST: async (req, res, { user }) => {
    if (!user) throw new HttpError(401, 'Please sign in with ORCID.');
    const b = body(req);
    const text = typeof b.body === 'string' ? b.body.replace(/\r\n/g, '\n').trim() : '';
    const len = charCount(text);
    if (len < 1) throw new HttpError(400, 'Write something first.');
    if (len > MAX_POST_CHARS) throw new HttpError(400, `Posts are limited to ${MAX_POST_CHARS} characters.`);

    let doi = null;
    if (b.doi && String(b.doi).trim()) {
      doi = normaliseDoi(b.doi);
      if (!doi) throw new HttpError(400, 'That DOI does not look valid (expected e.g. 10.1234/abcd).');
    }
    let link = null;
    if (b.link && String(b.link).trim()) {
      link = normaliseLink(b.link);
      if (!link) throw new HttpError(400, 'Links must be full http(s) URLs.');
    }
    let field = null;
    if (b.field) {
      if (!isField(String(b.field))) throw new HttpError(400, 'Unknown field.');
      field = String(b.field);
    }

    let parent = null;
    let repliedToUserId = null; // author of a nested reply we were answering
    if (b.parentId != null && b.parentId !== '') {
      const parentId = parseId(b.parentId);
      const { rows } = await query(
        `SELECT p.id, p.user_id, p.parent_id FROM posts p JOIN users u ON u.id = p.user_id
          WHERE p.id = $1 AND p.hidden_at IS NULL AND u.suspended_at IS NULL`,
        [parentId]
      );
      if (!rows[0]) throw new HttpError(404, 'The post you are replying to no longer exists.');
      parent = rows[0];
      // Keep threads one level deep: replies to a reply attach to the top-level post.
      if (parent.parent_id) {
        const top = await query('SELECT id, user_id, parent_id FROM posts WHERE id = $1', [parent.parent_id]);
        if (top.rows[0]) {
          repliedToUserId = parent.user_id;
          parent = top.rows[0];
        }
      }
    }

    const { rows: rate } = await query(
      `SELECT count(*)::int AS n FROM posts WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
      [user.id]
    );
    if (rate[0].n >= POSTS_PER_HOUR) throw new HttpError(429, 'You are posting very quickly. Please wait a little.');

    const tags = extractTags(text);
    if (field && !tags.includes(field)) tags.unshift(field);

    const post = await tx(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO posts (user_id, parent_id, body, doi, link, field)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text AS id, created_at`,
        [user.id, parent ? parent.id : null, text, doi, link, field]
      );
      for (const tag of tags.slice(0, 10)) {
        await client.query('INSERT INTO post_tags (post_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING', [rows[0].id, tag]);
      }
      return rows[0];
    });

    if (parent) {
      await notify(parent.user_id, user.id, 'reply', post.id).catch((e) => console.error('[notify]', e.message));
      if (repliedToUserId && String(repliedToUserId) !== String(parent.user_id)) {
        await notify(repliedToUserId, user.id, 'reply', post.id).catch((e) => console.error('[notify]', e.message));
      }
    }
    return res.status(201).json({ ok: true, id: post.id });
  },
});
