-- 搜索页默认按公开时间倒序取前几十条；没有这个索引就是每次都排 100 行（很小），但排序键要能被查询用上。
CREATE INDEX CONCURRENTLY IF NOT EXISTS poc_landed_released_idx ON poc_landed (released DESC NULLS LAST);
