-- NAVIXA Plus member seats.
-- One owner may have: 1 full member, 1 paid single-project member, and 2 Kids members.
-- Member privacy stays isolated; this table stores only entitlement and management metadata.
CREATE TABLE IF NOT EXISTS navixa_subscription_members (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  member_user_id TEXT NOT NULL DEFAULT '',
  member_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('full_member','project_member','kid')),
  project TEXT NOT NULL DEFAULT '' CHECK (project IN ('','fitness','learning','kids')),
  seat_no INTEGER NOT NULL CHECK (seat_no BETWEEN 1 AND 2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed','cooldown')),
  locked_until TEXT NOT NULL DEFAULT '',
  cooldown_until TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  removed_at TEXT NOT NULL DEFAULT '',
  CHECK ((role='project_member' AND project<>'') OR (role='kid' AND project='kids') OR (role='full_member' AND project=''))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_navixa_members_active_email
  ON navixa_subscription_members(lower(member_email)) WHERE status='active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_navixa_members_owner_seat
  ON navixa_subscription_members(owner_user_id, role, seat_no) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_navixa_members_identity
  ON navixa_subscription_members(member_user_id, status);
CREATE INDEX IF NOT EXISTS idx_navixa_members_owner
  ON navixa_subscription_members(owner_user_id, status, role);
