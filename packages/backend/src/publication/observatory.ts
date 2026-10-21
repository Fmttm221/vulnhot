// 观测台的数字：总量、24 小时新增、事件、KEV、信源健康、日报，加上「信源 → 分类」的流向和逐时热度。
// 和网站其它页面一样走公开读取层的判定（scope.ts），不另写一套可见性规则。
import type { Observatory } from "@aihot/contracts/site";
import { sql } from "../db.ts";
import { cachedByKey } from "../lib/cache.ts";
import { publicSourceName } from "./rules.ts";
import { listedCondition, selectedCondition } from "./scope.ts";

export type { Observatory };

/** 可信的时间窗口（小时）；其它值按最近 7 天算，避免有人用一个奇怪的窗口把缓存撑爆。 */
export const OBSERVATORY_WINDOWS = [1, 6, 24, 72, 168, 720] as const;

export function normalizeWindow(hours: number): number {
  return (OBSERVATORY_WINDOWS as readonly number[]).includes(hours) ? hours : 168;
}

const observatory = cachedByKey((hours: number) => String(hours), (hours) => query(new Date(), hours), {
  freshMs: 2 * 60_000,
  maxStaleMs: 30 * 60_000,
  maxKeys: 8,
});

export function loadObservatory(windowHours: number): Promise<Observatory> {
  return observatory(normalizeWindow(windowHours));
}

async function query(now: Date, windowHours: number): Promise<Observatory> {
  const start = new Date(now.getTime() - windowHours * 3600_000);
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);

  const [totalsRows, flowRows, categoryRows, heatRows, kev] = await Promise.all([
    sql<Array<{
      items: number; items24h: number; selected: number; stories: number; dailies: number;
      totalSources: number; enabledSources: number; failingSources: number;
    }>>`
      SELECT (SELECT count(*) FROM publications p WHERE p.visibility <> 'withdrawn')::int AS items,
             (SELECT count(*) FROM publications p WHERE p.visibility <> 'withdrawn' AND p.discovered_at > ${dayAgo})::int AS "items24h",
             (SELECT count(*) FROM publications p WHERE ${selectedCondition(now)})::int AS selected,
             (SELECT count(*) FROM stories WHERE merged_into IS NULL)::int AS stories,
             (SELECT count(*) FROM reports WHERE kind = 'daily')::int AS dailies,
             (SELECT count(*) FROM sources)::int AS "totalSources",
             (SELECT count(*) FROM sources WHERE enabled)::int AS "enabledSources",
             (SELECT count(*) FROM sources WHERE enabled AND fail_count > 0)::int AS "failingSources"`,
    sql<{ source: string; category: string; count: number }[]>`
      SELECT s.name AS source, COALESCE(p.category, '') AS category, count(*)::int AS count
      FROM publications p JOIN sources s ON s.id = p.source_id
      WHERE ${listedCondition(now)} AND p.timeline_at > ${start}
      GROUP BY 1, 2
      ORDER BY count DESC
      LIMIT 400`,
    sql<{ category: string; count: number }[]>`
      SELECT COALESCE(p.category, '') AS category, count(*)::int AS count
      FROM publications p
      WHERE ${listedCondition(now)} AND p.timeline_at > ${start}
      GROUP BY 1
      ORDER BY count DESC`,
    sql<{ at: string; count: number }[]>`
      SELECT to_char(date_trunc('hour', p.timeline_at), 'YYYY-MM-DD"T"HH24:00') AS at, count(*)::int AS count
      FROM publications p
      WHERE ${listedCondition(now)} AND p.timeline_at > ${start}
      GROUP BY 1
      ORDER BY 1`,
    countKev(),
  ]);

  const row = totalsRows[0]!;
  return {
    generatedAt: now.toISOString(),
    windowHours,
    totals: {
      items: row.items, items24h: row.items24h, selected: row.selected,
      stories: row.stories, kev, dailies: row.dailies,
    },
    sources: { total: row.totalSources, enabled: row.enabledSources, failing: row.failingSources },
    // 信源名走公开规则（publicSourceName）：有的来源要求匿名展示。
    flow: flowRows.map((r) => ({ source: publicSourceName(r.source), category: r.category, count: r.count })),
    categories: categoryRows,
    heat: heatRows,
  };
}

/** KEV 条数来自漏洞信号模块的私有表；没装模块（或模块还没抓过）时是 0，不是错误。 */
async function countKev(): Promise<number> {
  const [row] = await sql<{ present: boolean }[]>`SELECT to_regclass('public.cve_risk_signals') IS NOT NULL AS present`;
  if (!row?.present) return 0;
  const [count] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM cve_risk_signals WHERE in_kev`;
  return count?.n ?? 0;
}
