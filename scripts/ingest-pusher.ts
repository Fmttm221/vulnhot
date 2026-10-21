// 外部抓取推送：把需要凭据、需要渲染、或者只有官方 API 才能拿到的来源，抓下来推到本站的
// POST /api/ingest/items（见 docs/sources.md 的 external）。框架的六种信源装不下这些来源，
// 但引擎把它们当普通资料处理：照样预筛、评分、归组、出刊。
//
//   node --env-file=.env scripts/ingest-pusher.ts --source nvd  [--days 1] [--dry-run]
//   node --env-file=.env scripts/ingest-pusher.ts --source osv  --packages packages.txt
//   node --env-file=.env scripts/ingest-pusher.ts --source epss [--threshold 0.5]
//   node --env-file=.env scripts/ingest-pusher.ts --source openssf
//   node --env-file=.env scripts/ingest-pusher.ts --source cnvd   (需要 CNVD_COOKIE)
//   node --env-file=.env scripts/ingest-pusher.ts --source all
//
// 需要的环境变量：
//   SITE_URL         站点地址（默认 http://localhost:3000）
//   INGEST_TOKEN     推送令牌，至少 16 位；站点没设就一律 401
//   NVD_API_KEY      选填，NVD 无 key 时 5 次/30 秒
//   GITHUB_TOKEN     选填，GitHub API 额度从 60/小时提到 5000/小时
//   CNVD_COOKIE      抓 CNVD 用的会话 cookie（从浏览器复制）
//   OSV_PACKAGES     选填，逗号分隔的包名，等价于 --packages 文件
//
// 建议节奏（crontab）：
//   */30 * * * *  node --env-file=.env scripts/ingest-pusher.ts --source nvd
//   15 6 * * *    node --env-file=.env scripts/ingest-pusher.ts --source epss
//   */60 * * * *  node --env-file=.env scripts/ingest-pusher.ts --source openssf
//   30 */2 * * *  node --env-file=.env scripts/ingest-pusher.ts --source cnvd
import { readFileSync } from "node:fs";
import { beijingMidnight } from "@aihot/contracts/time";

const SITE = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.INGEST_TOKEN ?? "";
const UA = "VulnHOTBot/1.0 (+ingest-pusher)";

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] && !argv[at + 1]!.startsWith("--") ? argv[at + 1]! : fallback;
};
const has = (name: string) => argv.includes(`--${name}`);

const source = flag("source", "all")!;
const dryRun = has("dry-run");
const days = Number(flag("days", "1"));
const threshold = Number(flag("threshold", "0.5"));
const limit = Number(flag("limit", "40"));

interface Item {
  title: string;
  url: string;
  publishedAt: string;
  author?: string;
  raw?: Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const day = 86_400_000;

async function getJson(url: string, headers: Record<string, string> = {}, timeoutMs = 30_000): Promise<unknown> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json", ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function getText(url: string, headers: Record<string, string> = {}, timeoutMs = 30_000): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

/** 推给站点：每次最多 50 条（框架的上限），失败重试一次。 */
async function push(sourceId: string, sourceName: string, items: Item[]): Promise<void> {
  if (!items.length) return console.log(`[${sourceId}] 没有新条目`);
  if (dryRun) {
    console.log(`[${sourceId}] dry-run，${items.length} 条，前 3 条：`);
    for (const item of items.slice(0, 3)) console.log(`  - ${item.title.slice(0, 90)} ${item.url}`);
    return;
  }
  if (!TOKEN) throw new Error("没有 INGEST_TOKEN，站点会返回 401");
  let sent = 0;
  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50);
    const body = JSON.stringify({ sourceId, sourceName, items: chunk });
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const res = await fetch(`${SITE}/api/ingest/items`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", "user-agent": UA },
        body,
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        sent += chunk.length;
        break;
      }
      if (attempt === 2) throw new Error(`推送失败 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      await sleep(2_000);
    }
  }
  console.log(`[${sourceId}] 推送 ${sent} 条`);
}

// ── NVD：最近被修改过的 CVE（官方 2.0 API，无需 key，但限速 5 次/30 秒） ───────────────────
async function nvd(): Promise<Item[]> {
  const key = process.env.NVD_API_KEY?.trim();
  const end = new Date();
  const start = new Date(end.getTime() - days * day);
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, ".000Z");
  const items: Item[] = [];
  let startIndex = 0;
  for (let page = 0; page < 12; page += 1) {
    const url =
      "https://services.nvd.nist.gov/rest/json/cves/2.0" +
      `?lastModStartDate=${encodeURIComponent(iso(start))}&lastModEndDate=${encodeURIComponent(iso(end))}` +
      `&resultsPerPage=200&startIndex=${startIndex}`;
    const body = (await getJson(url, key ? { apiKey: key } : {}, 45_000)) as {
      totalResults?: number;
      vulnerabilities?: Array<{
        cve?: {
          id?: string;
          published?: string;
          descriptions?: Array<{ lang: string; value: string }>;
          metrics?: Record<string, Array<{ cvssData?: { baseScore?: number } }>>;
        };
      }>;
    };
    const rows = body.vulnerabilities ?? [];
    for (const v of rows) {
      const cve = v.cve;
      if (!cve?.id) continue;
      const english = cve.descriptions?.find((d) => d.lang === "en")?.value ?? cve.descriptions?.[0]?.value ?? "";
      const metrics = cve.metrics ?? {};
      const score = (metrics.cvssMetricV40 ?? metrics.cvssMetricV31 ?? metrics.cvssMetricV30 ?? [])[0]?.cvssData?.baseScore;
      const publishedAt = cve.published ?? iso(end);
      const old = Date.now() - new Date(publishedAt).getTime() > 2 * day;
      items.push({
        title: `${cve.id}${score ? ` (CVSS ${score})` : ""} ${english.replace(/\s+/g, " ").slice(0, 160)}`.trim(),
        url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
        publishedAt,
        author: "NVD",
        ...(old ? { raw: { _aihot: { backfill: true } } } : {}),
      });
    }
    startIndex += rows.length;
    if (items.length >= limit) break;
    if (!rows.length || startIndex >= (body.totalResults ?? 0) || startIndex >= 2000) break;
    await sleep(key ? 1_000 : 6_200);
  }
  return items.slice(0, limit);
}

// ── OSV：按包查询（OSV 没有"最近更新"的全量入口，所以按你关心的组件清单查） ─────────────────
async function osv(): Promise<Item[]> {
  const file = flag("packages");
  const raw = file ? readFileSync(file, "utf8") : (process.env.OSV_PACKAGES ?? "");
  const packages = raw
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [ecosystem, name, version] = line.split("@");
      return { ecosystem: (ecosystem ?? "").trim(), name: (name ?? "").trim(), version: version?.trim() || undefined };
    })
    .filter((p) => p.ecosystem && p.name);
  if (!packages.length) {
    console.log("[osv] 没有包清单：用 --packages 文件或 OSV_PACKAGES 环境变量给出（格式 ecosystem@name@version）");
    return [];
  }
  const items: Item[] = [];
  for (const pkg of packages) {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": UA },
      body: JSON.stringify({ package: { ecosystem: pkg.ecosystem, name: pkg.name }, ...(pkg.version ? { version: pkg.version } : {}) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.log(`[osv] ${pkg.ecosystem}/${pkg.name} HTTP ${res.status}`);
      continue;
    }
    const body = (await res.json()) as { vulns?: Array<{ id: string; summary?: string; published?: string; aliases?: string[] }> };
    for (const vuln of body.vulns ?? []) {
      const aliases = (vuln.aliases ?? []).filter((a) => a.startsWith("CVE-")).join(", ");
      items.push({
        title: `${pkg.name} ${aliases || vuln.id} ${(vuln.summary ?? "").replace(/\s+/g, " ").slice(0, 120)}`.trim(),
        url: `https://osv.dev/vulnerability/${vuln.id}`,
        publishedAt: vuln.published ?? new Date().toISOString(),
        author: "OSV",
      });
    }
    await sleep(300);
  }
  return items;
}

// ── EPSS：把"被利用概率已经很高、但我们还没报道过"的编号推成一条情报 ──────────────────────
async function epss(): Promise<Item[]> {
  const body = (await getJson(`https://api.first.org/data/v1/epss?order=!epss&limit=200`, {}, 40_000)) as {
    data?: Array<{ cve: string; epss: string; percentile: string }>;
  };
  const items: Item[] = [];
  for (const row of body.data ?? []) {
    const score = Number(row.epss);
    if (!Number.isFinite(score) || score < threshold) continue;
    const at = new Date().toISOString();
    items.push({
      title: `${row.cve} 的 EPSS 利用概率升至 ${(score * 100).toFixed(1)}%（分位 ${(Number(row.percentile) * 100).toFixed(0)}%）`,
      url: `https://nvd.nist.gov/vuln/detail/${row.cve}`,
      publishedAt: at,
      author: "FIRST EPSS",
      raw: { _aihot: { backfill: true } },
    });
  }
  return items.slice(0, Math.min(limit, 40));
}

// ── OpenSSF 恶意包库：从提交历史里取出新增条目（一个提交 = 一个或几个恶意包） ───────────────
async function openssf(): Promise<Item[]> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const commits = (await getJson("https://api.github.com/repos/ossf/malicious-packages/commits?per_page=20", headers)) as Array<{
    sha: string;
    html_url: string;
    commit: { message: string; committer: { date: string } };
  }>;
  const items: Item[] = [];
  for (const commit of commits ?? []) {
    const firstLine = commit.commit.message.split("\n")[0]?.replace(/\s+/g, " ").slice(0, 140) ?? "";
    if (!firstLine) continue;
    items.push({
      title: `OpenSSF 恶意包库更新：${firstLine}`,
      url: commit.html_url,
      publishedAt: commit.commit.committer.date,
      author: "OpenSSF",
      raw: { _aihot: { backfill: true } },
    });
  }
  return items;
}

// ── CNVD：需要带会话的站点抓取（骨架。会话 cookie 从浏览器复制，站点有防护，失败就跳过） ────
async function cnvd(): Promise<Item[]> {
  const cookie = process.env.CNVD_COOKIE?.trim();
  if (!cookie) {
    console.log("[cnvd] 没有 CNVD_COOKIE：这一路需要一个有效会话（浏览器登录后复制 cookie），跳过");
    return [];
  }
  // 解析 HTML 用站点自身的 cheerio 依赖（后端已有），不额外引依赖。
  const { load } = (await import("cheerio")) as typeof import("cheerio");
  const html = await getText("https://www.cnvd.org.cn/flaw/list", {
    cookie,
    accept: "text/html",
    referer: "https://www.cnvd.org.cn/",
  });
  const $ = load(html);
  const items: Item[] = [];
  $("table.tlist tbody tr").each((_, tr) => {
    const link = $(tr).find("a").first();
    const href = link.attr("href");
    const title = link.text().trim();
    const when = $(tr).find("td").last().text().trim();
    if (!href || !title) return;
    const url = href.startsWith("http") ? href : `https://www.cnvd.org.cn${href}`;
    const date = /(\d{4}-\d{2}-\d{2})/.exec(when)?.[1];
    items.push({
      title,
      url,
      publishedAt: date ? beijingMidnight(date).toISOString() : new Date().toISOString(),
      author: "CNVD",
    });
  });
  if (!items.length) console.log("[cnvd] 没解析到条目：选择器需要按实际页面调整（骨架代码在 cnvd() 里）");
  return items;
}

const RUNNERS: Array<{ key: string; sourceId: string; name: string; run: () => Promise<Item[]> }> = [
  { key: "nvd", sourceId: "ext-nvd-cve", name: "NVD 新增 CVE（外部推送）", run: nvd },
  { key: "osv", sourceId: "ext-osv", name: "OSV 开源漏洞库（外部推送）", run: osv },
  { key: "epss", sourceId: "ext-epss", name: "FIRST EPSS 评分（外部推送）", run: epss },
  { key: "openssf", sourceId: "ext-ossf-malicious", name: "OpenSSF 恶意包库（外部推送）", run: openssf },
  { key: "cnvd", sourceId: "ext-cnvd-login", name: "CNVD 详情（带会话）", run: cnvd },
];

const picked = source === "all" ? RUNNERS : RUNNERS.filter((r) => r.key === source);
if (!picked.length) {
  console.error(`未知的 --source：${source}（可选 ${RUNNERS.map((r) => r.key).join(" / ")} / all）`);
  process.exit(1);
}

for (const runner of picked) {
  try {
    const items = await runner.run();
    // 同一编号在窗口里可能重复出现，按 url 去重后再推。
    const unique = new Map(items.map((item) => [item.url, item]));
    await push(runner.sourceId, runner.name, [...unique.values()]);
  } catch (error) {
    console.error(`[${runner.key}] 失败：${(error as Error).message}`);
    if (source !== "all") process.exitCode = 1;
  }
}
