-- 每条精选资讯的红队视角 / 蓝队视角（modules/vuln-perspective）。
-- 一张表一条记录，按 article_id 覆盖写；revision 记录这段文字是从哪一版分析生成的，分析更新后会重写。
CREATE TABLE IF NOT EXISTS vuln_perspective (
  article_id text PRIMARY KEY,
  revision   int  NOT NULL,
  model      text,
  red_zh     text NOT NULL,
  blue_zh    text NOT NULL,
  facts      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
