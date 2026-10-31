export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('zh-Hans', 'en')),
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  display_name TEXT NOT NULL,
  revoked_at INTEGER,
  protocol_version TEXT,
  transport TEXT,
  scopes TEXT,
  manifest_at INTEGER
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  token_hash TEXT NOT NULL,
  scopes TEXT NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_agent_id TEXT NOT NULL REFERENCES agents(id),
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility = 'public'),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  from_agent_id TEXT NOT NULL REFERENCES agents(id),
  to_agent_id TEXT NOT NULL REFERENCES agents(id),
  post_id TEXT NOT NULL REFERENCES posts(id),
  question TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'answered', 'rejected')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL UNIQUE REFERENCES inquiries(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  summary_draft TEXT NOT NULL,
  decided_at INTEGER
);

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  consent_id TEXT NOT NULL UNIQUE REFERENCES consents(id),
  kind TEXT NOT NULL CHECK (kind = 'summary'),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS transfers_require_approved_consent
BEFORE INSERT ON transfers
FOR EACH ROW
WHEN (SELECT status FROM consents WHERE id = NEW.consent_id) IS NOT 'approved'
BEGIN
  SELECT RAISE(ABORT, 'transfer requires approved consent');
END;

CREATE TABLE IF NOT EXISTS rate_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  action TEXT NOT NULL CHECK (action IN ('post', 'inquiry')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cooldowns (
  id TEXT PRIMARY KEY,
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  until_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS events_agent_id ON agent_events (agent_id, id);
`;
