-- 「最近公开的利用」：pocindex 的 trending_poc.json 里的 landed 列表（每次同步整表重写，约 100 行）。
-- 与 poc_artifact 的区别：那里是「某个编号有哪些利用」，这里是「最近有哪些新公开的利用、什么时候公开的」，
-- 搜索页在没有输入时按时间列出来。
CREATE TABLE IF NOT EXISTS poc_landed (
  url       text PRIMARY KEY,
  cve_id    text,
  name      text,
  stars     int,
  released  timestamptz,
  in_kev    boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now()
);
