-- 文章页与单条页都按编号取条目，并按星数排序；没有这个索引，83k 个编号的表每次都要全表扫。
CREATE INDEX CONCURRENTLY IF NOT EXISTS poc_artifact_cve_idx ON poc_artifact (cve_id, stars DESC NULLS LAST);
