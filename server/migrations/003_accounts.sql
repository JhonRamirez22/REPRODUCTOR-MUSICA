CREATE TABLE IF NOT EXISTS accounts (
  id            uuid PRIMARY KEY,
  email         text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_lower_idx ON accounts (lower(email));

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash  char(64) PRIMARY KEY,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_sessions_account_idx ON auth_sessions (account_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
