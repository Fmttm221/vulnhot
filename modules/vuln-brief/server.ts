// 漏洞精读的后端（modules/vuln-brief）：定时挑出"值得精读"的精选，把本条正文 + 客观信号 +
// 同一事件的其他报道拼成材料，排队调用一次模型，写出"先认名字 + 背景三句话 + 精读六段"。
// 语料、回执与预算都走引擎的 providers（chatJson 内含回执与熔断），本模块只管自己的表与接口。
//
// 三条纪律：
// 1. 不是每条精选都精读：只给带 CVE 编号、且精选评分达到 SCORE_FLOOR 的条目写，一天还有总量上限；
//    排队时进 KEV、EPSS 高、有公开 PoC 的先写。
// 2. 只服务已公开的精选，与公开页面同一口径；撤销或更正后接口立刻不再返回。
// 3. 页面只读自己的表，不在读者打开页面时联网。
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { defineQueue, defineServerModule } from "@aihot/backend/modules";
import { enqueueOn } from "@aihot/backend/jobs/queue";
import { sql } from "@aihot/backend/db";
import { chatJson } from "@aihot/backend/providers/llm";
import { modelFor } from "@aihot/backend/editorial/models";
import { BRIEF_SYSTEM, briefUser, type SiblingReport } from "./prompt.ts";

/** 一次最多补几条：控制单次运行的花费，也让新精选先出现。 */
const PER_RUN = 3;
/** 一天最多生成几条精读：这就是这个模块的预算闸门，超了等明天。 */
const MAX_PER_DAY = 50;
/** 只补最近这么多天的精选：更老的是首次导入的存量，不再为它付费。 */
const WINDOW_DAYS = 30;
/** 门槛：精选评分达到这个分才写精读（评分是 0–100）。 */
const SCORE_FLOOR = 60;

const CVE_RE = /CVE-\d{4}-\d{4,7}/g;

const BriefSchema = z.object({
  who: z.string().trim().min(1).max(300),
  what: z.string().trim().min(1).max(300),
  why: z.string().trim().min(1).max(300),
  story: z.string().trim().min(1).max(800),
  usage: z.string().trim().min(1).max(800),
  impact: z.string().trim().min(1).max(800),
  // 工具或情报发布这类条目，读者没有可自查的步骤：允许留空，页面上不画这一段。
  check: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
  action: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
  terms: z.array(z.object({ term: z.string().trim().max(60), plain: z.string().trim().max(240) })).max(6).catch([]),
  caveats: z.array(z.string().trim().max(300)).max(3).catch([]),
});

interface Row {
  article_id: string;
  title: string;
  summary: string | null;
  category: string | null;
  tags: string[] | null;
  url: string;
  revision: number;
  body_text: string | null;
}

/** 今天已经生成几条：超过 MAX_PER_DAY 就不再排队。 */
async function madeToday(): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM vuln_brief WHERE created_at > date_trunc('day', now())`;
  return row?.n ?? 0;
}

/**
 * 还要写精读的精选：带 CVE 编号、精选评分达到 SCORE_FLOOR、最近 WINDOW_DAYS 天内、还没写过（或分析已更新）。
 * 排队顺序：进 KEV 的先写，其次 EPSS 高、GitHub 上相关仓库多、评分高、发布新的。
 */
export async function pendingBriefs(limit: number): Promise<string[]> {
  const rows = await sql<{ article_id: string }[]>`
    WITH sel AS (
      SELECT p.article_id, a.revision, p.score, p.published_at,
             (p.title || ' ' || coalesce(p.summary, '')) AS text
      FROM publications p
      JOIN articles a ON a.id = p.article_id
      WHERE p.visibility = 'public' AND p.selected
        AND p.score >= ${SCORE_FLOOR}
        AND p.published_at > now() - ${`${WINDOW_DAYS} days`}::interval
        AND NOT EXISTS (
          SELECT 1 FROM vuln_brief b WHERE b.article_id = p.article_id AND b.revision = a.revision
        )
    ), cves AS (
      SELECT DISTINCT sel.article_id, upper(m[1]) AS cve
      FROM sel, regexp_matches(sel.text, 'CVE-[0-9]{4}-[0-9]{4,7}', 'g') AS m
    ), scored AS (
      SELECT sel.article_id, sel.score, sel.published_at,
             bool_or(coalesce(sig.in_kev, false)) AS in_kev,
             max(coalesce(sig.epss, 0)) AS epss,
             max(coalesce(rc.total, 0)) AS repo_total
      FROM sel
      JOIN cves ON cves.article_id = sel.article_id
      LEFT JOIN cve_risk_signals sig ON sig.cve_id = cves.cve
      LEFT JOIN cve_repo_counts rc ON rc.cve_id = cves.cve
      GROUP BY sel.article_id, sel.score, sel.published_at
    )
    SELECT article_id FROM scored
    ORDER BY in_kev DESC, epss DESC, repo_total DESC, score DESC NULLS LAST, published_at DESC NULLS LAST
    LIMIT ${limit}`;
  return rows.map((r) => r.article_id);
}

/** 同一事件里除本条以外的其他报道：用来补事实，不让模型只凭一条薄材料硬写。 */
async function siblingsFor(articleId: string): Promise<SiblingReport[]> {
  return sql<SiblingReport[]>`
    SELECT s.name AS source, p.title, coalesce(p.summary, '') AS summary
    FROM publications p
    JOIN articles a ON a.id = p.article_id
    JOIN sources s ON s.id = a.source_id
    WHERE p.visibility = 'public'
      AND p.story_id IS NOT NULL
      AND p.story_id = (SELECT story_id FROM publications WHERE article_id = ${articleId} AND story_id IS NOT NULL)
      AND p.article_id <> ${articleId}
    ORDER BY p.published_at DESC NULLS LAST
    LIMIT 5`;
}

const composeQueue = defineQueue<{ articleId: string }>({
  name: "vuln-brief.compose",
  options: { policy: "short", retryLimit: 3, retryDelay: 90, retryBackoff: true, expireInSeconds: 1200 },
  worker: { batchSize: 1, pollingIntervalSeconds: 10 },
  run: async (batch) => {
    for (const data of batch) await composeBrief(data.articleId);
  },
});

/** 给一条精选生成精读。导出给脚本与后台用：一条一次模型调用。 */
export async function composeBrief(articleId: string): Promise<"ok" | "skipped"> {
  const [row] = await sql<Row[]>`
    SELECT p.article_id, p.title, p.summary, p.category, p.tags, p.url, a.revision, a.body_text
    FROM publications p JOIN articles a ON a.id = p.article_id
    WHERE p.article_id = ${articleId} AND p.visibility = 'public' AND p.selected`;
  if (!row) return "skipped";

  const cves = [...new Set(`${row.title} ${row.summary ?? ""}`.match(CVE_RE) ?? [])].map((c) => c.toUpperCase());
  const [sig] = cves.length
    ? await sql<{ cvss: string | null; epss: string | null; in_kev: boolean | null; kev_due_date: Date | null; total: number | null; sample: Array<{ name?: string }> | null }[]>`
        SELECT sig.cvss, sig.epss, sig.in_kev, sig.kev_due_date, rc.total, rc.sample
        FROM cve_risk_signals sig FULL JOIN cve_repo_counts rc ON rc.cve_id = sig.cve_id
        WHERE sig.cve_id = ANY(${cves}) OR rc.cve_id = ANY(${cves})
        ORDER BY coalesce(sig.in_kev, false) DESC, coalesce(sig.epss, 0) DESC
        LIMIT 1`
    : [];

  const model = await modelFor("brief");
  const result = await chatJson({
    model,
    purpose: "brief",
    subject: `article:${row.article_id}@${row.revision}`,
    promptVersion: "vuln-brief-2",
    system: BRIEF_SYSTEM,
    user: briefUser({
      title: row.title,
      summary: row.summary,
      category: row.category,
      tags: row.tags ?? [],
      url: row.url,
      body: row.body_text,
      signals: {
        cves,
        cvss: sig?.cvss != null ? Number(sig.cvss) : null,
        epss: sig?.epss != null ? Number(sig.epss) : null,
        inKev: sig?.in_kev ?? false,
        kevDue: sig?.kev_due_date ? sig.kev_due_date.toISOString().slice(0, 10) : null,
        pocRepos: sig?.total ?? null,
        pocSample: (sig?.sample ?? []).map((s) => s.name).filter((n): n is string => Boolean(n)),
      },
      siblings: await siblingsFor(row.article_id),
    }),
    schema: BriefSchema,
    temperature: 0.3,
    maxTokens: 3200,
  });

  const facts = {
    cves,
    cvss: sig?.cvss != null ? Number(sig.cvss) : null,
    epss: sig?.epss != null ? Number(sig.epss) : null,
    inKev: sig?.in_kev ?? false,
    pocRepos: sig?.total ?? null,
    caveats: result.data.caveats,
  };
  await sql`
    INSERT INTO vuln_brief (article_id, revision, model, who_zh, what_zh, why_zh, story_zh, usage_zh, impact_zh,
                            check_steps, actions, terms, facts)
    VALUES (${row.article_id}, ${row.revision}, ${model}, ${result.data.who}, ${result.data.what}, ${result.data.why},
            ${result.data.story}, ${result.data.usage}, ${result.data.impact},
            ${sql.json(result.data.check as never)}, ${sql.json(result.data.action as never)},
            ${sql.json(result.data.terms as never)}, ${sql.json(facts as never)})
    ON CONFLICT (article_id) DO UPDATE SET
      revision = EXCLUDED.revision, model = EXCLUDED.model, who_zh = EXCLUDED.who_zh,
      what_zh = EXCLUDED.what_zh, why_zh = EXCLUDED.why_zh, story_zh = EXCLUDED.story_zh,
      usage_zh = EXCLUDED.usage_zh, impact_zh = EXCLUDED.impact_zh,
      check_steps = EXCLUDED.check_steps, actions = EXCLUDED.actions, terms = EXCLUDED.terms,
      facts = EXCLUDED.facts, updated_at = now()`;
  return "ok";
}

export const vulnBriefServer = defineServerModule({
  name: "vuln-brief",
  models: {
    brief: { label: "漏洞精读（小白向）", env: "BRIEF_MODEL", purposes: ["brief"] },
  },
  queues: [composeQueue],
  schedules: [
    {
      name: "vuln-brief.enqueue",
      cron: "*/5 * * * *",
      run: async () => {
        const made = await madeToday();
        if (made >= MAX_PER_DAY) return { enqueued: 0, madeToday: made, capped: true };
        const ids = await pendingBriefs(Math.min(PER_RUN, MAX_PER_DAY - made));
        for (const articleId of ids) await enqueueOn(composeQueue, { articleId }, { singletonKey: articleId });
        return { enqueued: ids.length, madeToday: made };
      },
    },
  ],
  http: (app: FastifyInstance) => {
    // 网页在文章页上读精读。公开、匿名、只读；与公开页面一样只服务已公开的精选。
    app.get("/api/site/brief/:id", async (req, reply) => {
      const { id } = req.params as { id: string };
      const [row] = await sql<{ who_zh: string; what_zh: string; why_zh: string; story_zh: string; usage_zh: string; impact_zh: string; check_steps: string[]; actions: string[]; terms: Array<{ term: string; plain: string }>; facts: { caveats?: string[] }; model: string | null; updated_at: Date }[]>`
        SELECT v.who_zh, v.what_zh, v.why_zh, v.story_zh, v.usage_zh, v.impact_zh,
               v.check_steps, v.actions, v.terms, v.facts, v.model, v.updated_at
        FROM vuln_brief v JOIN publications p ON p.article_id = v.article_id
        WHERE v.article_id = ${id} AND p.visibility = 'public' AND p.selected`;
      reply.header("cache-control", "public, s-maxage=300, stale-while-revalidate=600");
      if (!row) return { brief: null };
      return {
        brief: {
          who: row.who_zh,
          what: row.what_zh,
          why: row.why_zh,
          story: row.story_zh,
          usage: row.usage_zh,
          impact: row.impact_zh,
          check: row.check_steps ?? [],
          action: row.actions ?? [],
          terms: row.terms ?? [],
          caveats: row.facts?.caveats ?? [],
          updatedAt: row.updated_at?.toISOString?.() ?? null,
        },
      };
    });
  },
});
