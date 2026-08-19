-- Keeps scheduled Push delivery inexpensive: provider refresh is rate-limited while delivery checks stay minute-accurate.
CREATE TABLE IF NOT EXISTS navixa_push_fixture_cache (
  fixture_id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL,
  league_name TEXT NOT NULL,
  home_name TEXT NOT NULL,
  away_name TEXT NOT NULL,
  kickoff TEXT NOT NULL,
  refreshed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_navixa_push_fixture_cache_kickoff ON navixa_push_fixture_cache(kickoff);
CREATE TABLE IF NOT EXISTS navixa_push_runtime_state (
  state_key TEXT PRIMARY KEY,
  state_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
