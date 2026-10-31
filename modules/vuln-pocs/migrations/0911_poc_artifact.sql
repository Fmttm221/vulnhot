-- PoC 索引里的利用条目：一条 CVE 下的仓库地址、Nuclei 模板、Metasploit 模块、ExploitDB 条目、
-- Vulhub 环境。同一个地址只留一行；stars 与 last_push 来自索引的仓库元数据，非 GitHub 的行为空。
CREATE TABLE IF NOT EXISTS poc_artifact (
  cve_id    text NOT NULL,
  kind      text NOT NULL,
  url       text NOT NULL,
  name      text,
  stars     int,
  last_push date,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cve_id, kind, url)
);
