-- 每日预算闸门按 created_at 统计当天生成了几条；旧表连同索引在 0906 删掉了，这里补回来。
CREATE INDEX CONCURRENTLY IF NOT EXISTS vuln_brief_created_idx ON vuln_brief (created_at DESC);
