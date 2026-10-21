-- 精读的每日预算闸门按 created_at 统计当天生成了几条，避免全表扫描（modules/vuln-brief）。
CREATE INDEX CONCURRENTLY IF NOT EXISTS vuln_brief_created_idx ON vuln_brief (created_at DESC);
