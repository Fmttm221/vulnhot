// 漏洞精读的后端（modules/vuln-brief）：定时挑出"值得精读"的精选，把本条正文 + 客观信号 +
// 同一事件的其他报道拼成材料，排队调用一次模型，写出"背景三句话 + 精读六段 + 名词小抄"。
// 语料、回执与预算都走引擎的 providers（chatJson 内含回执与熔断），本模块只管自己的表与接口。
//
// 三条纪律：
// 1. 不是每条精选都精读：只有满足触发条件（进 KEV / EPSS 高 / 有公开 PoC / 一手源 CVSS≥9 /
//    影响面命中）的条目才花钱，一天还有总量上限。
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
const PER_RUN = 2;
/** 一天最多生成几条精读：这就是这个模块的预算闸门，超了等明天。 */
const MAX_PER_DAY = 12;
/** 只补最近这么多天的精选：更老的是首次导入的存量，不再为它付费。 */
const WINDOW_DAYS = 30;
/** 触发条件：EPSS 下限、一手源 CVSS 下限。 */
const EPSS_FLOOR = 0.1;
const CVSS_FLOOR = 9.0;
/** 影响面白名单：命中标题或摘要里的产品名也算触发（这些一旦出事，读者最需要看。 */
const WATCH = [
  "nginx", "openssl", "tomcat", "vcenter", "esxi", "confluence", "jira", "citrix", "netscaler",
  "fortinet", "fortigate", "ivanti", "exchange", "sharepoint", "wordpress", "jenkins", "kubernetes",
  "struts", "log4j", "spring", "chrome", "firefox", "big-ip", "f5", "palo alto", "sonicwall",
  "vpn", "防火墙", "路由器", "插件",
];

const CVE_RE = /CVE-\d{4}-\d{4,7}/g;

const BriefSchema = z.object({
  who: z.string().trim().min(1).max(300),
  what: z.string().trim().min(1).max(300),
  why: z.string().trim().min(1).max(300),
  story: z.string().trim().min(1).max(800),
  usage: z.string().trim().min(1).max(800),
  impact: z.string().trim().min(1).max(800),
  check: z.array(z.string().trim().min(1).max(300)).min(1).max(4),
  action: z.array(z.string().trim().min(1).max(300)).min(1).max(4),
  terms: z.array(z.object({ term: z.string().trim().max(60), plain: z.string().trim().max(240) })).max(5).catch([]),
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
 * 还需要精读、且值得精读的精选（新的在前）。
 * 触发条件任一成立即可：进 KEV、EPSS ≥ 0.1、有公开 PoC 仓库、一手源且 CVSS ≥ 9.0、影响面命中白名单。
 */
export async function pendingBriefs(limit: number): Promise<string[]> {
  const rows = await sql<{ article_id: string }[]>`
    WITH sel AS (
      SELECT p.article_id, a.revision, s.tier, p.published_at,
             (p.title || ' ' || coalesce(p.summary, '')) AS text
      FROM publications p
      JOIN articles a ON a.id = p.article_id
      JOIN sources s ON s.id = a.source_id
      WHERE p.visibility = 'public' AND p.selected
        AND p.published_at > now() - ${`${WINDOW_DAYS} days`}::interval
        AND NOT EXISTS (
          SELECT 1 FROM vuln_brief b WHERE b.article_id = p.article_id AND b.revision = a.revision
        )
    ), hits AS (
      SELECT sel.*, upper(m[1]) AS cve
      FROM sel, regexp_matches(sel.text, 'CVE-[0-9]{4}-[0-9]{4,7}', 'g') AS m
    ), picked AS (
      SELECT DISTINCT ON (hits.article_id)
             hits.article_id, hits.tier, hits.published_at, hits.text,
             sig.cvss, sig.epss, sig.in_kev, rc.total AS repo_total
      FROM hits
      LEFT JOIN cve_risk_signals sig ON sig.cve_id = hits.cve
      LEFT JOIN cve_repo_counts rc ON rc.cve_id = hits.cve
      ORDER BY hits.article_id, coalesce(sig.in_kev, false) DESC, coalesce(sig.epss, 0) DESC
    )
    SELECT article_id FROM picked
    WHERE coalesce(in_kev, false)
       OR coalesce(epss, 0) >= ${EPSS_FLOOR}
       OR coalesce(repo_total, 0) > 0
       OR (tier = 'T1' AND coalesce(cvss, 0) >= ${CVSS_FLOOR})
       OR EXISTS (SELECT 1 FROM unnest(${WATCH}::text[]) AS w(term) WHERE picked.text ILIKE '%' || w.term || '%')
    ORDER BY published_at DESC NULLS LAST
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
    promptVersion: "vuln-brief-1",
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
    maxTokens: 3000,
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
      cron: "*/10 * * * *",
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
