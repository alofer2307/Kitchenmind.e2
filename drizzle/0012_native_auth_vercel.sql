CREATE TABLE IF NOT EXISTS auth_credentials (
  id TEXT PRIMARY KEY NOT NULL,
  subject_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  password_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_credentials_subject_unique ON auth_credentials(subject_id);
CREATE UNIQUE INDEX IF NOT EXISTS auth_credentials_email_unique ON auth_credentials(email_normalized);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  subject_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_unique ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS auth_sessions_subject_status_idx ON auth_sessions(subject_id, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  subject_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_hash_unique ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_subject_idx ON password_reset_tokens(subject_id, expires_at, used_at);
