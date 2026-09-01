-- Central delegated membership model for the NAVIXA portfolio.
-- Existing Plus subscribers remain implicit owners and do not require rows here.

CREATE TABLE IF NOT EXISTS navixa_portfolio_memberships (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  member_user_id TEXT NOT NULL,
  member_type TEXT NOT NULL CHECK(member_type IN ('full','project','child')),
  project_scope TEXT NOT NULL DEFAULT '' CHECK(project_scope IN ('','fitness','kids','learning')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  access_ends_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(member_user_id <> owner_user_id),
  CHECK(
    (member_type='full' AND project_scope='') OR
    (member_type='project' AND project_scope IN ('fitness','kids','learning')) OR
    (member_type='child' AND project_scope='kids')
  )
);

-- One authenticated account cannot belong to two active subscriptions at the same time.
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

-- NAVIXA Kids allows at most two active child members per Plus owner.
CREATE TRIGGER IF NOT EXISTS trg_navixa_portfolio_max_two_children_insert
BEFORE INSERT ON navixa_portfolio_memberships
WHEN NEW.member_type='child' AND NEW.status='active'
  AND (
    SELECT COUNT(*) FROM navixa_portfolio_memberships
    WHERE owner_user_id=NEW.owner_user_id AND member_type='child' AND status='active'
  ) >= 2
BEGIN
  SELECT RAISE(ABORT, 'NAVIXA Kids supports at most two active child members');
END;

CREATE TRIGGER IF NOT EXISTS trg_navixa_portfolio_max_two_children_update
BEFORE UPDATE OF owner_user_id,member_type,status ON navixa_portfolio_memberships
WHEN NEW.member_type='child' AND NEW.status='active'
  AND (
    SELECT COUNT(*) FROM navixa_portfolio_memberships
    WHERE owner_user_id=NEW.owner_user_id AND member_type='child' AND status='active' AND id<>OLD.id
  ) >= 2
BEGIN
  SELECT RAISE(ABORT, 'NAVIXA Kids supports at most two active child members');
END;

CREATE INDEX IF NOT EXISTS idx_navixa_portfolio_owner_members
  ON navixa_portfolio_memberships(owner_user_id, member_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_navixa_portfolio_member_access
  ON navixa_portfolio_memberships(member_user_id, status, updated_at DESC);
