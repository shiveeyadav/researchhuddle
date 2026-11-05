import { api } from '../../../lib/http';
import { query } from '../../../lib/db';

// GET /api/me/export - UK GDPR data portability: everything we hold about the signed-in user.
export default api(
  {
    GET: async (req, res, { user }) => {
      const [profile, works, posts, likes, following, followers, reports] = await Promise.all([
        query(
          `SELECT orcid, name, biography, keywords, affiliations, email, digest_opt_in, last_digest_at,
                  last_import_at, created_at, last_login_at FROM users WHERE id = $1`,
          [user.id]
        ),
        query('SELECT title, year, journal, doi, url, work_type FROM works WHERE user_id = $1 ORDER BY year DESC NULLS LAST', [user.id]),
        query(
          `SELECT id::text AS id, parent_id::text AS parent_id, body, doi, link, field, created_at, hidden_at
             FROM posts WHERE user_id = $1 ORDER BY id`,
          [user.id]
        ),
        query('SELECT post_id::text AS post_id, created_at FROM likes WHERE user_id = $1 ORDER BY created_at', [user.id]),
        query(
          `SELECT u.orcid, f.created_at FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = $1`,
          [user.id]
        ),
        query(
          `SELECT u.orcid, f.created_at FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = $1`,
          [user.id]
        ),
        query('SELECT post_id::text AS post_id, reason, created_at FROM reports WHERE reporter_id = $1', [user.id]),
      ]);
      res.setHeader('Content-Disposition', `attachment; filename="researchhuddle-${user.orcid}.json"`);
      return res.status(200).json({
        exportedAt: new Date().toISOString(),
        profile: profile.rows[0],
        works: works.rows,
        posts: posts.rows,
        likes: likes.rows,
        following: following.rows,
        followers: followers.rows,
        reportsMade: reports.rows,
      });
    },
  },
  { auth: true }
);
