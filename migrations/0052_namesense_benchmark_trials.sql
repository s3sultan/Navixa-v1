CREATE TABLE IF NOT EXISTS navixa_namesense_benchmark_speakers (
  speaker_id TEXT PRIMARY KEY,
  accent TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS navixa_namesense_benchmark_trials (
  trial_id TEXT PRIMARY KEY,
  speaker_id TEXT NOT NULL,
  accent TEXT NOT NULL,
  watched_name_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  device_class TEXT NOT NULL,
  browser TEXT NOT NULL,
  noise TEXT NOT NULL,
  expected TEXT NOT NULL CHECK(expected IN ('hit','miss')),
  detected INTEGER NOT NULL CHECK(detected IN (0,1)),
  latency_eligible INTEGER NOT NULL CHECK(latency_eligible IN (0,1)),
  latency_ms INTEGER,
  latency_boundary TEXT NOT NULL,
  signal_quality_passed INTEGER NOT NULL CHECK(signal_quality_passed = 1),
  vad_speech_confirmed INTEGER NOT NULL CHECK(vad_speech_confirmed = 1),
  signal_rms REAL NOT NULL,
  signal_variance REAL NOT NULL,
  split TEXT NOT NULL CHECK(split = 'holdout'),
  provenance TEXT NOT NULL CHECK(provenance = 'controlled-live'),
  capture_method TEXT NOT NULL CHECK(capture_method = 'live-microphone'),
  consent INTEGER NOT NULL CHECK(consent = 1),
  raw_audio_retained INTEGER NOT NULL CHECK(raw_audio_retained = 0),
  match_method TEXT,
  match_score REAL,
  captured_at TEXT NOT NULL,
  FOREIGN KEY (speaker_id) REFERENCES navixa_namesense_benchmark_speakers(speaker_id)
);

CREATE INDEX IF NOT EXISTS idx_namesense_benchmark_accent ON navixa_namesense_benchmark_trials(accent, captured_at);
CREATE INDEX IF NOT EXISTS idx_namesense_benchmark_speaker ON navixa_namesense_benchmark_trials(speaker_id, accent);
CREATE INDEX IF NOT EXISTS idx_namesense_benchmark_expected ON navixa_namesense_benchmark_trials(accent, expected, detected);
