-- Aggregate field performance metrics. No account, identifier, IP, content,
-- event target, or recording is stored with any browser measurement.
ALTER TABLE navixa_performance_samples ADD COLUMN lcp_ms INTEGER;
ALTER TABLE navixa_performance_samples ADD COLUMN inp_ms INTEGER;
ALTER TABLE navixa_performance_samples ADD COLUMN cls_milli INTEGER;
ALTER TABLE navixa_performance_windows ADD COLUMN avg_lcp_ms INTEGER;
ALTER TABLE navixa_performance_windows ADD COLUMN p95_lcp_ms INTEGER;
ALTER TABLE navixa_performance_windows ADD COLUMN avg_inp_ms INTEGER;
ALTER TABLE navixa_performance_windows ADD COLUMN p95_inp_ms INTEGER;
ALTER TABLE navixa_performance_windows ADD COLUMN avg_cls_milli INTEGER;
