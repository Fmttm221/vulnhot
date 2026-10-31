import { t as translate } from "@aihot/web/lib/i18n";
// 文章页上的「公开利用」：这条资讯提到的 CVE 在公开索引里有多少个利用条目、最热的几个仓库在哪。
// 数据来自模块自己的接口（页面打开时不联网到外部）；没有公开利用的条目什么都不显示，不占版面。
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { SiteItemDetail } from "@aihot/contracts/site";

type Kind = "poc" | "nuclei" | "msf" | "edb" | "vulhub" | "collections";

interface Artifact {
  kind: Kind;
  url: string;
  name: string;
  stars: number | null;
  lastPush: string | null;
}

interface Poc {
  cve: string;
  description: string | null;
  published: string | null;
  counts: Record<Kind, number>;
  signals: { cvss: number | null; epss: number | null; inKev: boolean } | null;
  artifacts: Artifact[];
}

const cache = new Map<string, Poc | null>();
const CVE_RE = /CVE-\d{4}-\d{4,7}/i;

export function PocBlock({ item }: { item: SiteItemDetail }) {
  const cve = CVE_RE.exec(`${item.title} ${item.summary ?? ""}`)?.[0]?.toUpperCase() ?? null;
  const [poc, setPoc] = useState<Poc | null>(() => (cve ? cache.get(cve) ?? null : null));

  useEffect(() => {
    if (!cve) return;
    const hit = cache.get(cve);
    if (hit !== undefined) {
      setPoc(hit);
      return;
    }
    let alive = true;
    fetch(`/api/site/pocs/${encodeURIComponent(cve)}`, { headers: { accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { poc?: Poc | null } | null) => {
        const value = json?.poc ?? null;
        cache.set(cve, value);
        if (alive) setPoc(value);
      })
      .catch(() => {
        /* 没有就不打断阅读 */
      });
    return () => {
      alive = false;
    };
  }, [cve]);

  if (!cve || !poc) return null;
  if (Object.values(poc.counts).every((n) => n === 0)) return null;

  // 标签在渲染时取当前语言的文案（模块级的常量会把第一次请求的语言冻住）。
  const labels: Array<[Kind, string]> = [
    ["poc", translate("PoC 仓库")],
    ["nuclei", translate("Nuclei 模板")],
    ["msf", translate("Metasploit 模块")],
    ["edb", translate("ExploitDB 条目")],
    ["vulhub", translate("Vulhub 环境")],
    ["collections", translate("集合仓库")],
  ];
  const repos = poc.artifacts.filter((a) => a.kind === "poc").slice(0, 5);
  const others = labels
    .filter(([kind]) => kind !== "poc")
    .map(([kind, label]) => ({ kind, label, first: poc.artifacts.find((a) => a.kind === kind) }))
    .filter((entry) => entry.first);

  return (
    <div className="mt-7 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[12px] font-semibold text-ink-3">{translate("公开利用")}</div>
        <Link viewTransition to={`/poc/${poc.cve}`} className="text-[11.5px] text-ink-4 transition-colors hover:text-accent">
          {translate("在 PoC 索引里看这条")} · {poc.cve}
        </Link>
      </div>

      <div className="rounded-card border border-line-soft bg-surface-2 px-4 py-3.5">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
          {labels.filter(([kind]) => poc.counts[kind] > 0).map(([kind, label]) => (
            <span key={kind} className="flex items-baseline gap-1.5">
              <span className="text-ink-4">{label}</span>
              <span className="num font-semibold text-ink">{poc.counts[kind]}</span>
            </span>
          ))}
        </div>

        {repos.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line-soft pt-2.5">
            {repos.map((repo) => (
              <li key={repo.url} className="flex items-baseline gap-2 text-[13px]">
                <a href={repo.url} target="_blank" rel="noopener noreferrer" className="mono min-w-0 truncate text-ink-2 transition-colors hover:text-accent">
                  {repo.name}
                </a>
                {repo.stars !== null && repo.stars > 0 && <span className="shrink-0 text-[11.5px] text-ink-4">{repo.stars}★</span>}
              </li>
            ))}
          </ul>
        )}

        {others.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {others.map((entry) => (
              <a key={entry.kind} href={entry.first!.url} target="_blank" rel="noopener noreferrer" className="chip transition-colors hover:text-accent" title={entry.first!.name}>
                {entry.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
