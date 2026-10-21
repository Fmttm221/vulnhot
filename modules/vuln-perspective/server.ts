// 红蓝视角的后端：定时挑出还没有这两段的精选，排队调用一次模型写出来；
// 语料、回执与预算都走引擎的 providers（chatJson 内含回执与熔断），本模块只管自己的表与接口。
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { defineQueue, defineServerModule } from "@aihot/backend/modules";
import { enqueueOn } from "@aihot/backend/jobs/queue";
import { sql } from "@aihot/backend/db";
import { chatJson } from "@aihot/backend/providers/llm";
import { modelFor } from "@aihot/backend/editorial/models";
import { PERSPECTIVE_SYSTEM, perspectiveUser } from "./prompt.ts";

/** 一次最多补几条：控制单次运行的花费，也让新精选先出现。 */
const PER_RUN = 6;
/** 只补最近这么多天的精选：更老的是首次导入的存量，不再为它付费（页面标注为历史条目未生成）。 */
const WINDOW_DAYS = 120;

const PerspectiveSchema = z.object({
  red: z.string().trim().min(1).max(4000),
  blue: z.string().trim().min(1).max(4000),
  caveats: z.array(z.string().trim().max(200)).max(3).catch([]),
});

interface Row {
  article_id: string;
  title: string;
  summary: string | null;
  category: string | null;
  tags: string[];
  url: string;
  revision: number;
  body_text: string | null;
}

const composeQueue = defineQueue<{ articleId: string }>({
  name: "vuln-perspective.compose",
  options: { policy: "short", retryLimit: 3, retryDelay: 60, retryBackoff: true, expireInSeconds: 900 },
  worker: { batchSize: 2, pollingIntervalSeconds: 5 },
  run: async (batch) => {
    for (const data of batch) await composeOne(data.articleId);
  },
});

async function composeOne(articleId: string): Promise<void> {
  const [row] = await sql<Row[]>`
    SELECT p.article_id, p.title, p.summary, p.category, p.tags, p.url, a.revision, a.body_text
    FROM publications p JOIN articles a ON a.id = p.article_id
    WHERE p.article_id = ${articleId} AND p.visibility = 'public' AND p.selected`;
  if (!row) return;
  const model = await modelFor("perspective");
  const result = await chatJson({
    model,
    purpose: "perspective",
    subject: `article:${row.article_id}@${row.revision}`,
    promptVersion: "vuln-perspective-1",
    system: PERSPECTIVE_SYSTEM,
    user: perspectiveUser({
      title: row.title,
      summary: row.summary,
      category: row.category,
      tags: row.tags ?? [],
      url: row.url,
      body: row.body_text,
    }),
    schema: PerspectiveSchema,
    temperature: 0.3,
    maxTokens: 3200,
  });
  await sql`
    INSERT INTO vuln_perspective (article_id, revision, model, red_zh, blue_zh, facts)
    VALUES (${row.article_id}, ${row.revision}, ${model}, ${result.data.red}, ${result.data.blue}, ${sql.json({ caveats: result.data.caveats } as never)})
    ON CONFLICT (article_id) DO UPDATE SET
      revision = EXCLUDED.revision, model = EXCLUDED.model, red_zh = EXCLUDED.red_zh,
      blue_zh = EXCLUDED.blue_zh, facts = EXCLUDED.facts, updated_at = now()`;
}

/** 还有哪些精选缺这两段（或分析更新过），新的在前。 */
async function pending(limit: number): Promise<string[]> {
  const rows = await sql<{ article_id: string }[]>`
    SELECT p.article_id
    FROM publications p JOIN articles a ON a.id = p.article_id
    LEFT JOIN vuln_perspective v ON v.article_id = p.article_id
    WHERE p.selected AND p.visibility = 'public'
      AND p.published_at > now() - ${`${WINDOW_DAYS} days`}::interval
      AND (v.article_id IS NULL OR v.revision <> a.revision)
    ORDER BY p.published_at DESC NULLS LAST
    LIMIT ${limit}`;
  return rows.map((r) => r.article_id);
}

export const vulnPerspectiveServer = defineServerModule({
  name: "vuln-perspective",
  models: {
    perspective: { label: "红队/蓝队视角", env: "PERSPECTIVE_MODEL", purposes: ["perspective"] },
  },
  queues: [composeQueue],
  schedules: [
    {
      name: "vuln-perspective.enqueue",
      cron: "*/4 * * * *",
      run: async () => {
        const ids = await pending(PER_RUN);
        for (const articleId of ids) await enqueueOn(composeQueue, { articleId }, { singletonKey: articleId });
        return { enqueued: ids.length };
      },
    },
  ],
  http: (app: FastifyInstance) => {
    // 网页在文章页上读这两段。公开、匿名、只读；与公开页面一样只服务已公开的精选。
    app.get("/api/site/perspective/:id", async (req, reply) => {
      const { id } = req.params as { id: string };
      const [row] = await sql<{ red_zh: string; blue_zh: string; facts: { caveats?: string[] }; model: string | null; updated_at: Date }[]>`
        SELECT v.red_zh, v.blue_zh, v.facts, v.model, v.updated_at
        FROM vuln_perspective v JOIN publications p ON p.article_id = v.article_id
        WHERE v.article_id = ${id} AND p.visibility = 'public' AND p.selected`;
      reply.header("cache-control", "public, s-maxage=300, stale-while-revalidate=600");
      if (!row) return { red: null, blue: null, caveats: [], updatedAt: null, pending: true };
      return {
        red: row.red_zh,
        blue: row.blue_zh,
        caveats: row.facts?.caveats ?? [],
        updatedAt: row.updated_at?.toISOString?.() ?? null,
      };
    });
  },
});
