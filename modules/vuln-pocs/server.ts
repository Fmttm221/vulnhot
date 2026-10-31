// PoC 索引的后端（modules/vuln-pocs）：每 6 小时把 pocindex 的公开索引同步进 poc_cve / poc_artifact，
// 并把「这条 CVE 有哪些公开利用」交给网页。索引是公开数据，同步不产生费用，也没有速率限制。
import type { FastifyInstance } from "fastify";
import { defineServerModule } from "@aihot/backend/modules";
import { sql } from "@aihot/backend/db";
import { syncPocIndex, type Kind } from "./sync.ts";

interface Artifact {
  kind: Kind;
  url: string;
  name: string;
  stars: number | null;
  lastPush: string | null;
}

/** 一条 CVE 的公开利用：数量、各类条目（GitHub 仓库在前）、以及别的模块抓到的风险信号（有就带上）。 */
export async function pocDetail(cveId: string): Promise<{
  cve: string;
  description: string | null;
  published: string | null;
  counts: Record<Kind, number>;
  signals: { cvss: number | null; epss: number | null; inKev: boolean } | null;
  artifacts: Artifact[];
} | null> {
  const id = cveId.trim().toUpperCase();
  const [row] = await sql<{
    cve_id: string; description: string | null; published: string | null;
    poc_count: number; nuclei_count: number; msf_count: number; edb_count: number; vulhub_count: number; collection_count: number;
  }[]>`
    SELECT cve_id, description, to_char(published, 'YYYY-MM-DD') AS published,
           poc_count, nuclei_count, msf_count, edb_count, vulhub_count, collection_count
    FROM poc_cve WHERE cve_id = ${id}`;
  if (!row) return null;

  const artifacts = await sql<{ kind: Kind; url: string; name: string; stars: number | null; last_push: string | null }[]>`
    SELECT kind, url, coalesce(name, url) AS name, stars, to_char(last_push, 'YYYY-MM-DD') AS last_push
    FROM poc_artifact WHERE cve_id = ${id}
    ORDER BY stars DESC NULLS LAST, url
    LIMIT 60`;

  // 风险信号由 vuln-signals 抓：只对它收录过的编号有值，没有就不显示（不在两处各存一份）。
  let signals: { cvss: number | null; epss: number | null; inKev: boolean } | null = null;
  try {
    const [signal] = await sql<{ cvss: number | null; epss: number | null; in_kev: boolean }[]>`
      SELECT cvss::float8 AS cvss, epss::float8 AS epss, in_kev FROM cve_risk_signals WHERE cve_id = ${id}`;
    if (signal) signals = { cvss: signal.cvss, epss: signal.epss, inKev: signal.in_kev };
  } catch {
    signals = null;
  }

  return {
    cve: row.cve_id,
    description: row.description,
    published: row.published,
    counts: {
      poc: row.poc_count, nuclei: row.nuclei_count, msf: row.msf_count,
      edb: row.edb_count, vulhub: row.vulhub_count, collections: row.collection_count,
    },
    signals,
    artifacts: artifacts.map((a) => ({ kind: a.kind, url: a.url, name: a.name, stars: a.stars, lastPush: a.last_push })),
  };
}

/** 按编号前缀或描述关键词找：编号优先，其余按公开利用条目多少排。 */
export async function searchPocs(query: string, limit: number): Promise<Array<{ cve: string; description: string | null; poc: number; nuclei: number }>> {
  const q = query.trim();
  if (!q) return [];
  const rows = /^cve-/i.test(q)
    ? await sql<{ cve_id: string; description: string | null; poc_count: number; nuclei_count: number }[]>`
        SELECT cve_id, description, poc_count, nuclei_count FROM poc_cve
        WHERE cve_id LIKE ${q.toUpperCase() + "%"}
        ORDER BY poc_count DESC, cve_id LIMIT ${limit}`
    : await sql<{ cve_id: string; description: string | null; poc_count: number; nuclei_count: number }[]>`
        SELECT cve_id, description, poc_count, nuclei_count FROM poc_cve
        WHERE description ILIKE ${"%" + q + "%"}
        ORDER BY poc_count DESC, cve_id LIMIT ${limit}`;
  return rows.map((r) => ({ cve: r.cve_id, description: r.description, poc: r.poc_count, nuclei: r.nuclei_count }));
}

/** 最近公开的利用：按公开时间倒序。搜索页在没有关键词时列这个。 */
export async function latestPocs(limit: number): Promise<Array<{ url: string; cve: string | null; name: string; stars: number | null; released: string | null; kev: boolean }>> {
  const rows = await sql<{ url: string; cve_id: string | null; name: string | null; stars: number | null; released: Date | null; in_kev: boolean }[]>`
    SELECT url, cve_id, name, stars, released, in_kev
    FROM poc_landed ORDER BY released DESC NULLS LAST LIMIT ${limit}`;
  // 交给浏览器的永远是完整的 ISO 时间：to_char 的 +08 没有分钟，new Date() 会解析成 Invalid Date。
  return rows.map((r) => ({
    url: r.url,
    cve: r.cve_id,
    name: r.name ?? r.url,
    stars: r.stars,
    released: r.released?.toISOString?.() ?? null,
    kev: r.in_kev,
  }));
}

export const vulnPocsServer = defineServerModule({
  name: "vuln-pocs",
  schedules: [
    {
      name: "vuln-pocs.sync",
      // 整份清单约 11 MB：每 6 小时一次，够新，也不至于吃流量。
      cron: "17 */6 * * *",
      run: async () => ({ ...(await syncPocIndex()) }),
    },
  ],
  http: (app: FastifyInstance) => {
    // 文章页与单条页读这里：公开、匿名、只读。
    app.get("/api/site/pocs/:cve", async (req, reply) => {
      const { cve } = req.params as { cve: string };
      reply.header("cache-control", "public, s-maxage=600, stale-while-revalidate=3600");
      const detail = await pocDetail(cve);
      if (!detail) return { poc: null };
      return { poc: detail };
    });
    app.get("/api/site/pocs/latest", async (req, reply) => {
      const limit = Math.min(Math.max(Number((req.query as { limit?: string }).limit ?? 40) || 40, 1), 100);
      reply.header("cache-control", "public, s-maxage=300, stale-while-revalidate=3600");
      return { items: await latestPocs(limit) };
    });
    app.get("/api/site/pocs/search", async (req, reply) => {
      const query = String((req.query as { q?: string }).q ?? "");
      const limit = Math.min(Math.max(Number((req.query as { limit?: string }).limit ?? 30) || 30, 1), 60);
      reply.header("cache-control", "public, s-maxage=300, stale-while-revalidate=600");
      return { q: query, items: await searchPocs(query, limit) };
    });
  },
});
