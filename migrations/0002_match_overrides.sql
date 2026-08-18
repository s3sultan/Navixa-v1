-- NAVIXA match presentation overrides managed from the protected admin panel.
CREATE TABLE IF NOT EXISTS navixa_match_overrides (
  match_id TEXT PRIMARY KEY,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
  home_name_ar TEXT,
  away_name_ar TEXT,
  league_name_ar TEXT,
  home_logo TEXT,
  away_logo TEXT,
  show_home_logo INTEGER NOT NULL DEFAULT 1 CHECK(show_home_logo IN (0,1)),
  show_away_logo INTEGER NOT NULL DEFAULT 1 CHECK(show_away_logo IN (0,1)),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_navixa_match_overrides_updated_at
  ON navixa_match_overrides(updated_at);
