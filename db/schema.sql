-- ResearchHuddle schema. Idempotent: safe to run on every container start.

CREATE TABLE IF NOT EXISTS users (
  id               BIGSERIAL PRIMARY KEY,
  orcid            VARCHAR(19) NOT NULL UNIQUE,
  name             TEXT,
  biography        TEXT,
  keywords         TEXT[] NOT NULL DEFAULT '{}',
  affiliations     JSONB NOT NULL DEFAULT '[]'::jsonb,
  affiliation_text TEXT NOT NULL DEFAULT '',
  email            TEXT,
  digest_opt_in    BOOLEAN NOT NULL DEFAULT FALSE,
  last_digest_at   TIMESTAMPTZ,
  last_import_at   TIMESTAMPTZ,
  import_error     TEXT,
  suspended_at     TIMESTAMPTZ,
  suspended_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS users_digest_idx ON users (digest_opt_in) WHERE digest_opt_in;

CREATE TABLE IF NOT EXISTS works (
  id        BIGSERIAL PRIMARY KEY,
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  put_code  TEXT,
  title     TEXT NOT NULL,
  year      INT,
  journal   TEXT,
  doi       TEXT,
  url       TEXT,
  work_type TEXT
);

CREATE INDEX IF NOT EXISTS works_user_idx ON works (user_id, year DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS sessions (
  id         BIGSERIAL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS posts (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id     BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  body          TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  doi           TEXT,
  link          TEXT,
  field         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  hidden_at     TIMESTAMPTZ,
  hidden_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  hidden_reason TEXT
);

CREATE INDEX IF NOT EXISTS posts_top_idx ON posts (id DESC) WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS posts_user_idx ON posts (user_id, id DESC);
CREATE INDEX IF NOT EXISTS posts_parent_idx ON posts (parent_id, id);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE INDEX IF NOT EXISTS post_tags_tag_idx ON post_tags (tag, post_id DESC);

CREATE TABLE IF NOT EXISTS likes (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS likes_post_idx ON likes (post_id);

CREATE TABLE IF NOT EXISTS follows (
  follower_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('like', 'reply', 'follow')),
  post_id    BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ
);

-- PostgreSQL 15+: one notification per (recipient, actor, type, post), even when post_id is NULL.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx
  ON notifications (user_id, actor_id, type, post_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, id DESC);

CREATE TABLE IF NOT EXISTS reports (
  id          BIGSERIAL PRIMARY KEY,
  post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS reports_open_idx ON reports (created_at) WHERE resolved_at IS NULL;

-- Housekeeping on every start
DELETE FROM sessions WHERE expires_at < now();
