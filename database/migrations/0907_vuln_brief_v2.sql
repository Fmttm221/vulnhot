-- 精读的新表（取代 0903 的六段结构）：正文是一篇用空行分段的短文，重点用 ==…== 标在文内；
-- 自查与处置仍是短条目；signals 与 caveats 放在 facts 里。
CREATE TABLE IF NOT EXISTS vuln_brief (
  article_id  text PRIMARY KEY,
  revision    int  NOT NULL,
  model       text,
  body_zh     text NOT NULL,
  check_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions     jsonb NOT NULL DEFAULT '[]'::jsonb,
  facts       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
