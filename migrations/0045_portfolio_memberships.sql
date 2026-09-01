-- Central delegated membership model for the NAVIXA portfolio.
-- Existing Plus subscribers remain implicit owners and do not require rows here.
-- Kids children are project-local child profiles, not subscription member accounts.

CREATE TABLE IF NOT EXISTS navixa_portfolio_memberships (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  member_user_id TEXT NOT NULL,
  member_type TEXT NOT NULL CHECK(member_type IN ('full','project')),
  project_scope TEXT NOT NULL DEFAULT '' CHECK(project_scope IN ('','fitness','kids','learning')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  access_ends_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(member_user_id <> owner_user_id),
  CHECK(
    (member_type='full' AND project_scope='') OR
    (member_type='project' AND project_scope IN ('fitness','kids','learning'))
  )
);

-- One authenticated member account cannot belong to two active subscription owners at the same time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_navixa_portfolio_member_user_active
  ON navixa_portfolio_memberships(member_user_id)
  WHERE status='active';

-- A Plus owner can have one comprehensive additional member.
CREATE UNIQUE INDEX IF NOT EXISTS idx_navixa_portfolio_one_full_member
  ON navixa_portfolio_memberships(owner_user_id)
  WHERE member_type='full' AND status='active';

-- A Plus owner can have one paid additional account for one project only.
CREATE UNIQUE INDEX IF NOT EXISTS idx_navixa_portfolio_one_project_member
  ON navixa_portfolio_memberships(owner_user_id)
  WHERE member_type='project' AND status='active';

CREATE INDEX IF NOT EXISTS idx_navixa_portfolio_owner_members
  ON navixa_portfolio_memberships(owner_user_id, member_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_navixa_portfolio_member_access
  ON navixa_portfolio_memberships(member_user_id, status, updated_at DESC);
