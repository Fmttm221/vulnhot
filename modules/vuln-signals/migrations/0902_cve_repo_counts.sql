-- 按 CVE 编号统计 GitHub 上提到它的仓库（modules/vuln-signals）：回答"这个编号到今天一共有多少个 PoC 仓库"。
-- total 是搜索接口报的匹配总数（不是取回的条数），sample 存前几个仓库用来展示。
CREATE TABLE IF NOT EXISTS cve_repo_counts (
  cve_id            text PRIMARY KEY,
  total             integer NOT NULL DEFAULT 0,
  sample            jsonb   NOT NULL DEFAULT '[]'::jsonb,
  github_fetched_at timestamptz NOT NULL DEFAULT now()
);
