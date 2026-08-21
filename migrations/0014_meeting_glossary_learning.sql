-- Shared glossary learning stores only short, sanitised terms and correction aliases.
-- It never stores audio, full transcripts, session titles, user identifiers, or source files.
CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_terms (
  id TEXT PRIMARY KEY,
  canonical_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'mixed',
  active INTEGER NOT NULL DEFAULT 0,
  correction_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_navixa_meeting_glossary_active
  ON navixa_meeting_glossary_terms(active, updated_at DESC);

CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_aliases (
  id TEXT PRIMARY KEY,
  term_id TEXT NOT NULL,
  alias_text TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(term_id, normalized_alias)
);
CREATE INDEX IF NOT EXISTS idx_navixa_meeting_glossary_aliases_term
  ON navixa_meeting_glossary_aliases(term_id, active, usage_count DESC);

INSERT OR IGNORE INTO navixa_meeting_feature_settings (setting_key,setting_value,updated_at)
VALUES ('global_learning_enabled','true',datetime('now'));
