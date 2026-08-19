-- Shared manual fixtures are created and deleted only by the protected administration panel.
CREATE TABLE IF NOT EXISTS navixa_admin_manual_matches (
  match_id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  league_name TEXT NOT NULL,
  home_name TEXT NOT NULL,
  away_name TEXT NOT NULL,
  home_logo TEXT NOT NULL DEFAULT '',
  away_logo TEXT NOT NULL DEFAULT '',
  kickoff TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','live','finished')),
  home_score INTEGER,
  away_score INTEGER,
  venue TEXT NOT NULL DEFAULT '',
  venue_city TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_navixa_admin_manual_matches_kickoff
  ON navixa_admin_manual_matches(kickoff);
