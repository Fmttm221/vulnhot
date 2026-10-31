// 客观风险信号的后端：从 NVD 取 CVSS、从 FIRST 取 EPSS、从 CISA 取 KEV；PoC 条目数不再自己数
// （GitHub 搜索有速率限制、也只覆盖 GitHub 一家），改由 vuln-pocs 模块同步的公开索引提供。
// 再把一条资讯需要的所有信号与它的进展时间线合成一个接口给文章页用。
//
// 三条纪律：
// 1. 只抓我们自己收录过的 CVE（从 publications 的标题与摘要里抽编号），不为全库付代价。
// 2. 每个来源各有自己的节奏与请求间隔：NVD 未认证 5 次/30 秒，所以一次只补一小批，剩下的下一轮再补。
// 3. 抓到的都是外部数据，写进自己的表；页面只读表，不在读者打开页面时联网。
import type { FastifyInstance } from "fastify";
import { defineServerModule } from "@aihot/backend/modules";
import { sql } from "@aihot/backend/db";

const CVE_RE = /CVE-\d{4}-\d{4,7}/g;
const UA = "VulnHOTBot/1.0 (+https://vuln.hot)";

/** 我们收录过、需要信号的 CVE：近 120 天公开过的精选里出现过的编号。 */
async function trackedCves(limit: number): Promise<string[]> {
  const rows = await sql<{ cve: string }[]>`
    WITH texts AS (
      SELECT p.title || ' ' || coalesce(p.summary, '') AS text
      FROM publications p
      WHERE p.visibility = 'public' AND p.selected AND p.published_at > now() - interval '120 days'
    )
    SELECT DISTINCT upper(m[1]) AS cve
    FROM texts, regexp_matches(texts.text, 'CVE-[0-9]{4}-[0-9]{4,7}', 'g') AS m
    LIMIT ${limit}`;
  return rows.map((r) => r.cve);
}

async function ensureRows(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await sql`INSERT INTO cve_risk_signals ${sql(ids.map((cve) => ({ cve_id: cve })))}
            ON CONFLICT (cve_id) DO NOTHING`;
}

async function fetchJson(url: string, timeoutMs = 25_000): Promise<unknown> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── EPSS（FIRST，每日更新，一次可查几十个编号） ────────────────────────────────────────────
export async function syncEpss(limit = 200): Promise<number> {
  const ids = (await trackedCves(limit)).filter(Boolean);
  if (!ids.length) return 0;
  let done = 0;
  for (let i = 0; i < ids.length; i += 60) {
    const batch = ids.slice(i, i + 60);
    const url = `https://api.first.org/data/v1/epss?cve=${batch.join(",")}&limit=${batch.length * 2}`;
    const body = (await fetchJson(url)) as { data?: Array<{ cve: string; epss: string; percentile: string }> };
    for (const row of body.data ?? []) {
      const epss = Number(row.epss);
      const percentile = Number(row.percentile);
      if (!Number.isFinite(epss)) continue;
      await sql`UPDATE cve_risk_signals SET epss = ${epss}, epss_percentile = ${Number.isFinite(percentile) ? percentile : null},
                epss_fetched_at = now() WHERE cve_id = ${row.cve.toUpperCase()}`;
      done += 1;
    }
  }
  return done;
}

// ── CISA KEV（每天变几次；抓不到就跳过，下一轮再来） ───────────────────────────────────────
export async function syncKev(): Promise<number> {
  const ids = await trackedCves(500);
  if (!ids.length) return 0;
  await ensureRows(ids);
  const body = (await fetchJson("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", 40_000)) as {
    vulnerabilities?: Array<{ cveID: string; dueDate?: string }>;
  };
  const due = new Map<string, string | null>();
  for (const v of body.vulnerabilities ?? []) due.set(v.cveID.toUpperCase(), v.dueDate ?? null);
  for (const cve of ids) {
    const has = due.has(cve);
    await sql`UPDATE cve_risk_signals
              SET in_kev = ${has}, kev_due_date = ${has ? due.get(cve) ?? null : null}::date, kev_fetched_at = now()
              WHERE cve_id = ${cve}`;
  }
  return due.size;
}

// ── NVD（CVSS；未认证 5 次/30 秒，所以一次只补 18 个，间隔 6.2 秒） ────────────────────────
export async function syncCvss(perRun = 18): Promise<number> {
  const rows = await sql<{ cve_id: string }[]>`
    SELECT cve_id FROM cve_risk_signals
    WHERE nvd_fetched_at IS NULL OR nvd_fetched_at < now() - interval '30 days'
    ORDER BY nvd_fetched_at NULLS FIRST LIMIT ${perRun}`;
  let done = 0;
  for (const [index, row] of rows.entries()) {
    if (index > 0) await sleep(6_200);
    try {
      const body = (await fetchJson(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${row.cve_id}`)) as {
        vulnerabilities?: Array<{ cve?: { metrics?: Record<string, Array<{ cvssData?: { baseScore?: number; vectorString?: string } }>> } }>;
      };
      const metrics = body.vulnerabilities?.[0]?.cve?.metrics ?? {};
      const picked = metrics.cvssMetricV40?.[0] ?? metrics.cvssMetricV31?.[0] ?? metrics.cvssMetricV30?.[0] ?? metrics.cvssMetricV2?.[0];
      const score = picked?.cvssData?.baseScore;
      await sql`UPDATE cve_risk_signals SET cvss = ${typeof score === "number" ? score : null},
                cvss_vector = ${picked?.cvssData?.vectorString ?? null}, nvd_fetched_at = now() WHERE cve_id = ${row.cve_id}`;
      done += 1;
    } catch {
      // 压不下来就下一轮；记一次时间避免每轮都撞同一个坏编号
      await sql`UPDATE cve_risk_signals SET nvd_fetched_at = now() WHERE cve_id = ${row.cve_id}`;
    }
  }
  return done;
}

// ── 文章页要的一份合成数据 ────────────────────────────────────────────────────────────────
interface ItemRow {
  article_id: string;
  title: string;
  summary: string | null;
  category: string | null;
  tags: string[];
  score: number | null;
  published_at: Date | null;
  fact_id: number | null;
  story_id: number | null;
}

interface SignalRow {
  cve_id: string;
  cvss: number | null;
  cvss_vector: string | null;
  epss: number | null;
  epss_percentile: number | null;
  in_kev: boolean;
  kev_due_date: string | null;
  repo_total: number | null;
  repo_sample: Array<{ name: string; url: string; stars: number }> | null;
}

const SURFACE: Array<{ key: string; test: (tags: string[], text: string) => boolean; hint: string }> = [
  { key: "免认证", test: (tags) => tags.includes("免认证"), hint: "无需登录即可触达" },
  { key: "无需交互", test: (tags) => tags.includes("无需交互"), hint: "不需要受害者点任何东西" },
  { key: "RCE", test: (tags) => tags.includes("RCE"), hint: "能直接执行代码" },
  { key: "边界设备", test: (tags) => tags.includes("VPN/网关") || tags.includes("网络设备"), hint: "通常是互联网入口" },
  { key: "内存破坏", test: (tags) => tags.includes("内存破坏"), hint: "需要精巧构造" },
];

export const vulnSignalsServer = defineServerModule({
  name: "vuln-signals",
  schedules: [
    {
      name: "vuln-signals.kev",
      cron: "0 */6 * * *",
      missed: "once",
      run: async () => ({ kev: await syncKev() }),
    },
    {
      name: "vuln-signals.epss",
      cron: "20 5 * * *",
      missed: "once",
      run: async () => ({ epss: await syncEpss() }),
    },
    {
      name: "vuln-signals.cvss",
      cron: "*/10 * * * *",
      run: async () => ({ cvss: await syncCvss() }),
    },
  ],
  http: (app: FastifyInstance) => {
    app.get("/api/site/signals/:id", async (req, reply) => {
      const { id } = req.params as { id: string };
      const [item] = await sql<ItemRow[]>`
        SELECT p.article_id, p.title, p.summary, p.category, p.tags, p.score::float8 AS score, p.published_at,
               p.fact_id, p.story_id
        FROM publications p
        WHERE p.article_id = ${id} AND p.visibility = 'public'`;
      reply.header("cache-control", "public, s-maxage=60, stale-while-revalidate=300");
      if (!item) return { cves: [], signals: [], timeline: [], surface: [], scoring: null };

      const text = `${item.title} ${item.summary ?? ""}`;
      const cves = [...new Set((text.match(CVE_RE) ?? []).map((c) => c.toUpperCase()))].slice(0, 3);

      let signals: SignalRow[] = [];
      if (cves.length) {
        signals = await sql<SignalRow[]>`
          SELECT s.cve_id, s.cvss::float8 AS cvss, s.cvss_vector, s.epss::float8 AS epss, s.epss_percentile::float8 AS epss_percentile,
                 s.in_kev, to_char(s.kev_due_date, 'YYYY-MM-DD') AS kev_due_date,
                 null::int AS repo_total, null::jsonb AS repo_sample
          FROM cve_risk_signals s
          WHERE s.cve_id IN ${sql(cves)}`;
        // 公开利用条目由 vuln-pocs 模块同步（可选模块：没装就没有这一段，文章页也就不显示）。
        try {
          const pocs = await sql<{ cve_id: string; total: number; sample: SignalRow["repo_sample"] }[]>`
            SELECT p.cve_id, p.poc_count AS total,
                   (SELECT json_agg(x ORDER BY x.stars DESC NULLS LAST, x.url)
                    FROM (SELECT name, url, stars FROM poc_artifact
                          WHERE cve_id = p.cve_id AND kind = 'poc'
                          ORDER BY stars DESC NULLS LAST, url LIMIT 3) x) AS sample
            FROM poc_cve p WHERE p.cve_id IN ${sql(cves)}`;
          const byCve = new Map(pocs.map((p) => [p.cve_id, p]));
          signals = signals.map((s) => {
            const poc = byCve.get(s.cve_id);
            return poc ? { ...s, repo_total: poc.total, repo_sample: poc.sample } : s;
          });
        } catch {
          /* 没装 vuln-pocs 就只有 CVSS/EPSS/KEV */
        }
      }

      // 同一次发生（同一个 fact）下已经公开的报道，就是这条的进展时间线。
      const timeline = item.fact_id
        ? await sql<{ id: string; title: string; source: string; at: Date; selected: boolean }[]>`
            SELECT p.article_id AS id, p.title, s.name AS source, coalesce(p.published_at, p.discovered_at) AS at, p.selected
            FROM publications p JOIN sources s ON s.id = p.source_id
            WHERE p.fact_id = ${item.fact_id} AND p.visibility = 'public'
            ORDER BY at ASC LIMIT 12`
        : [];

      const tags = item.tags ?? [];
      const surface = SURFACE.filter((s) => s.test(tags, text)).map((s) => ({ key: s.key, hint: s.hint }));
      const kev = signals.find((s) => s.in_kev) ?? null;
      const repos = signals.reduce((max, s) => Math.max(max, s.repo_total ?? 0), 0);

      return {
        cves,
        signals,
        surface,
        timeline: timeline.map((t) => ({ ...t, at: t.at?.toISOString?.() ?? null })),
        scoring: {
          score: item.score,
          category: item.category,
          tags,
          publishedAt: item.published_at?.toISOString?.() ?? null,
        },
        maturity: {
          disclosed: true,
          poc: tags.includes("PoC/复现") || repos > 0,
          wild: item.category === "exploited" || tags.includes("在野利用"),
          kev: Boolean(kev),
          patched: tags.includes("补丁/修复"),
        },
        kevDue: kev?.kev_due_date ?? null,
        pocRepos: repos,
      };
    });
  },
});
