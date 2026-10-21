-- 精选资讯的"小白精读"（modules/vuln-brief）。
-- 一条精选一行，按 article_id 覆盖写；revision 记录这段文字由哪一版分析生成，分析更新后重写。
-- 前三列是给所有人的"背景三句话"；后面六列是精读六段；terms 是本文出现的名词小抄。
CREATE TABLE IF NOT EXISTS vuln_brief (
  article_id  text PRIMARY KEY,
  revision    int  NOT NULL,
  model       text,
  who_zh      text NOT NULL,
  what_zh     text NOT NULL,
  why_zh      text NOT NULL,
  story_zh    text NOT NULL,
  usage_zh    text NOT NULL,
  impact_zh   text NOT NULL,
  check_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions     jsonb NOT NULL DEFAULT '[]'::jsonb,
  terms       jsonb NOT NULL DEFAULT '[]'::jsonb,
  facts       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

