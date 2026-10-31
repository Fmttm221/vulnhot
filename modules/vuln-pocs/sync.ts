// PoC 索引的同步（modules/vuln-pocs）：把 pocindex 的公开索引（无需 key、无速率限制）拉下来，
// 写进我们自己的两张表。索引里的 CVSS/EPSS/KEV 不在这里落地——那三样由 vuln-signals 自己抓、
// 自己在文章页展示，两处各存一份迟早对不上。
import { guardedFetch } from "@aihot/backend/lib/http-fetch";
import { sql } from "@aihot/backend/db";

const BASE = "https://pocindex.io";
/** 整份清单传 10 MB、解开约 50 MB；仓库元数据传 0.5 MB、解开约 1.5 MB。 */
const LIST_BYTES = 96 * 1024 * 1024;
const META_BYTES = 16 * 1024 * 1024;

/** 一条 CVE 下的利用条目分这几类，页面按这个顺序列。 */
export const KINDS = ["poc", "nuclei", "msf", "edb", "vulhub", "collections"] as const;
export type Kind = (typeof KINDS)[number];

/** 索引里一条 CVE 的形状（只列我们用得到的字段）。 */
interface IndexEntry {
  cve?: string;
  desc?: string;
  published?: string;
  modified?: string;
  poc?: string[];
  nuclei?: string[];
  msf?: string[];
  edb?: string[];
  vulhub?: string[];
  collections?: string[];
}

/** 仓库键（小写 owner/repo）→ [星数, 最后推送日期]。 */
type RepoMeta = Record<string, [number | null, string | null]>;

export interface CveRow {
  cve_id: string;
  description: string | null;
  published: string | null;
  modified: string | null;
  poc_count: number;
  nuclei_count: number;
  msf_count: number;
  edb_count: number;
  vulhub_count: number;
  collection_count: number;
}

export interface ArtifactRow {
  cve_id: string;
  kind: Kind;
  url: string;
  name: string;
  stars: number | null;
  last_push: string | null;
}

/** `https://github.com/owner/repo/...` → `owner/repo`（小写），用来对仓库元数据里的星数。 */
export function repoKey(url: string): string | null {
  const match = /^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/([^/?#]+)/i.exec(url);
  return match ? `${match[1]!.toLowerCase()}/${match[2]!.toLowerCase()}` : null;
}

/** 地址的最后一段（解码后）。 */
function tailOf(url: string): string {
  const tail = url.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? url;
  try {
    return decodeURIComponent(tail) || url;
  } catch {
    return tail;
  }
}

/** 一条的显示名：仓库根地址给 owner/repo，仓库里的文件给「owner/repo · 文件名」，其余给最后一段。 */
export function artifactName(url: string): string {
  const key = repoKey(url);
  if (!key) return tailOf(url);
  const path = url.replace(/^https?:\/\/(?:www\.)?github\.com\//i, "").replace(/[?#].*$/, "").replace(/\/+$/, "").split("/");
  return path.length <= 2 ? key : `${key} · ${tailOf(url)}`;
}

/** 索引里的日期是 `YYYY-MM-DD`；读不出来就当没有。 */
function dayOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 10) : null;
}

function timeOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
}

/** 把索引的一条整理成一行 CVE；没有编号的丢掉。 */
export function toCveRow(entry: IndexEntry): CveRow | null {
  const cve = (entry.cve ?? "").trim().toUpperCase();
  if (!/^CVE-\d{4}-\d{4,}$/.test(cve)) return null;
  const description = (entry.desc ?? "").trim();
  return {
    cve_id: cve,
    description: description ? description.slice(0, 2000) : null,
    published: dayOrNull(entry.published),
    modified: timeOrNull(entry.modified),
    poc_count: entry.poc?.length ?? 0,
    nuclei_count: entry.nuclei?.length ?? 0,
    msf_count: entry.msf?.length ?? 0,
    edb_count: entry.edb?.length ?? 0,
    vulhub_count: entry.vulhub?.length ?? 0,
    collection_count: entry.collections?.length ?? 0,
  };
}

/** 一条 CVE 的利用条目：每类的每个地址一行，带上仓库星数与最后推送日期。 */
export function toArtifacts(entry: IndexEntry, meta: RepoMeta): ArtifactRow[] {
  const cve = (entry.cve ?? "").trim().toUpperCase();
  if (!cve) return [];
  const rows: ArtifactRow[] = [];
  for (const kind of KINDS) {
    for (const url of (entry[kind] ?? []) as string[]) {
      const href = url.trim();
      if (!href) continue;
      const key = repoKey(href);
      const [stars, lastPush] = key ? (meta[key] ?? [null, null]) : [null, null];
      rows.push({ cve_id: cve, kind, url: href, name: artifactName(href), stars, last_push: dayOrNull(lastPush ?? undefined) });
    }
  }
  return rows;
}

async function getJson<T>(path: string, maxBytes: number): Promise<T> {
  const res = await guardedFetch(`${BASE}/${path}`, {
    headers: { accept: "application/json", "user-agent": "VulnHOT/poc-index sync" },
    timeoutMs: 120_000,
    maxBytes,
  });
  return JSON.parse(res.text()) as T;
}

/** 一次同步的规模：少于这个数就当作没拉全，不删旧数据（宁可留着一份旧的，也不要清空）。 */
const SANE_CVES = 20_000;
const BATCH = 800;

/**
 * 拉一份索引并写库：CVE 一行一个，利用条目一类一行。
 * 先写这一轮见过的行（`synced_at` 记成开始时间），最后删掉这一轮没见到的，索引里下架的内容随之消失。
 */
export async function syncPocIndex(): Promise<{ cves: number; artifacts: number; ms: number; skipped?: string }> {
  const started = Date.now();
  const runAt = new Date().toISOString();
  const entries = await getJson<IndexEntry[]>("CVE_list.json", LIST_BYTES);
  if (!Array.isArray(entries)) return { cves: 0, artifacts: 0, ms: Date.now() - started, skipped: "CVE_list.json is not an array" };

  // 仓库元数据只在有 GitHub 地址时用得上；它拉不下来就照旧写条目，只是没有星数。
  let meta: RepoMeta = {};
  try {
    meta = await getJson<RepoMeta>("repo_meta.json", META_BYTES);
  } catch {
    meta = {};
  }

  const cves: CveRow[] = [];
  const artifacts: ArtifactRow[] = [];
  for (const entry of entries) {
    const row = toCveRow(entry);
    if (!row) continue;
    cves.push(row);
    artifacts.push(...toArtifacts(entry, meta));
  }

  for (let i = 0; i < cves.length; i += BATCH) {
    const batch = cves.slice(i, i + BATCH);
    await sql`
      INSERT INTO poc_cve ${sql(batch, "cve_id", "description", "published", "modified", "poc_count",
        "nuclei_count", "msf_count", "edb_count", "vulhub_count", "collection_count")}
      ON CONFLICT (cve_id) DO UPDATE SET
        description = EXCLUDED.description, published = EXCLUDED.published, modified = EXCLUDED.modified,
        poc_count = EXCLUDED.poc_count, nuclei_count = EXCLUDED.nuclei_count, msf_count = EXCLUDED.msf_count,
        edb_count = EXCLUDED.edb_count, vulhub_count = EXCLUDED.vulhub_count,
        collection_count = EXCLUDED.collection_count, synced_at = ${runAt}::timestamptz`;
  }

  for (let i = 0; i < artifacts.length; i += BATCH) {
    const batch = artifacts.slice(i, i + BATCH);
    await sql`
      INSERT INTO poc_artifact ${sql(batch, "cve_id", "kind", "url", "name", "stars", "last_push")}
      ON CONFLICT (cve_id, kind, url) DO UPDATE SET
        name = EXCLUDED.name, stars = EXCLUDED.stars, last_push = EXCLUDED.last_push,
        synced_at = ${runAt}::timestamptz`;
  }

  // 这一轮没见到的行已经下架（或者索引暂时缺了一块）：只有规模看着正常才清，避免一次半截响应把表清空。
  if (cves.length >= SANE_CVES) {
    await sql`DELETE FROM poc_cve WHERE synced_at < ${runAt}::timestamptz`;
    await sql`DELETE FROM poc_artifact WHERE synced_at < ${runAt}::timestamptz`;
  }

  return { cves: cves.length, artifacts: artifacts.length, ms: Date.now() - started };
}
