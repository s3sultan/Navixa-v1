-- Privacy-preserving browser performance monitoring.
-- No user identifier, account reference, IP address, Cookie, or message content is stored.
CREATE TABLE IF NOT EXISTS navixa_performance_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL CHECK(path IN ('/', '/health')),
  ttfb_ms INTEGER NOT NULL CHECK(ttfb_ms BETWEEN 0 AND 120000),
  load_ms INTEGER NOT NULL CHECK(load_ms BETWEEN 0 AND 120000),
  captured_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_navixa_performance_samples_window
  ON navixa_performance_samples (captured_at, path, load_ms);

CREATE TABLE IF NOT EXISTS navixa_performance_windows (
  bucket_start TEXT NOT NULL,
  path TEXT NOT NULL CHECK(path IN ('/', '/health')),
  sample_count INTEGER NOT NULL,
  avg_ttfb_ms INTEGER NOT NULL,
  avg_load_ms INTEGER NOT NULL,
  p95_load_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (bucket_start, path)
);

CREATE TABLE IF NOT EXISTS navixa_performance_alert_state (
  path TEXT PRIMARY KEY CHECK(path IN ('/', '/health')),
  last_alert_at TEXT NOT NULL,
  last_p95_load_ms INTEGER NOT NULL,
  last_sample_count INTEGER NOT NULL
);
