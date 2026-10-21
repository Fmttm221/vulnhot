// 文章页上的客观信号：指标行、风险画像雷达、进展阶段与时间线、攻击面标签、纠错入口。
// 数据来自模块接口（页面打开时不联网；接口只读我们自己表里的缓存）。
import { useEffect, useState } from "react";
import type { SiteItemDetail } from "@aihot/contracts/site";

interface Signal {
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

interface Payload {
  cves: string[];
  signals: Signal[];
  surface: Array<{ key: string; hint: string }>;
  timeline: Array<{ id: string; title: string; source: string; at: string | null; selected: boolean }>;
  scoring: { score: number | null; category: string | null; tags: string[]; publishedAt: string | null } | null;
  maturity: { disclosed: boolean; poc: boolean; wild: boolean; kev: boolean; patched: boolean };
  kevDue: string | null;
  pocRepos: number;
}

const cache = new Map<string, Payload>();

function Chip({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1 rounded-control border border-line-soft bg-surface px-2 py-1 ${tone}`}>
      <span className="text-[11px] text-ink-4">{label}</span>
      <span className="mono text-[12.5px] font-semibold text-ink-2">{value}</span>
    </span>
  );
}

/** 五个轴的雷达：全部由客观信号折算，0–1。 */
function Radar({ axes }: { axes: Array<{ label: string; value: number }> }) {
  const size = 132;
  const center = size / 2;
  const radius = size / 2 - 20;
  const point = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio] as const;
  };
  const ring = (ratio: number) => axes.map((_, i) => point(i, ratio).join(",")).join(" ");
  const shape = axes.map((axis, i) => point(i, Math.max(0.04, Math.min(1, axis.value))).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="风险画像">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={ring(r)} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
      ))}
      {axes.map((axis, i) => {
        const [x, y] = point(i, 1);
        return <line key={axis.label} x1={center} y1={center} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />;
      })}
      <polygon points={shape} fill="var(--accent)" fillOpacity="0.18" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" />
      {axes.map((axis, i) => {
        const [x, y] = point(i, 1.22);
        return (
          <text key={axis.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-ink-3" fontSize="8.5">
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

const STAGES = [
  { key: "disclosed", label: "披露" },
  { key: "poc", label: "公开 PoC" },
  { key: "wild", label: "在野利用" },
  { key: "kev", label: "KEV" },
  { key: "patched", label: "补丁" },
] as const;

function relative(iso: string | null): string {
  if (!iso) return "";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export function SignalBlock({ item }: { item: SiteItemDetail }) {
  const [data, setData] = useState<Payload | null>(() => cache.get(item.id) ?? null);

  useEffect(() => {
    if (cache.has(item.id)) {
      setData(cache.get(item.id)!);
      return;
    }
    let alive = true;
    fetch(`/api/site/signals/${encodeURIComponent(item.id)}`, { headers: { accept: "application/json" } })
      .then((res) => (res.ok ? (res.json() as Promise<Payload>) : null))
      .then((json) => {
        if (!json) return;
        cache.set(item.id, json);
        if (alive) setData(json);
      })
      .catch(() => {
        /* 拿不到就不显示 */
      });
    return () => {
      alive = false;
    };
  }, [item.id]);

  const report = () => {
    // 走引擎自己的反馈页：先把草稿写进本站的草稿键，反馈页会读它并预填。
    try {
      localStorage.setItem(
        "vulnhot-correction",
        JSON.stringify({
          content: `这一条需要更正：\n${window.location.origin}/items/${item.id}\n《${item.title}》\n\n问题在哪：`,
          email: "",
          pageUrl: `${window.location.origin}/items/${item.id}`,
        }),
      );
    } catch {
      /* 隐私模式下只跳转 */
    }
    window.location.href = "/feedback";
  };

  if (!data) return null;
  const primary = data.signals[0] ?? null;
  const metrics = primary
    ? [
        primary.cvss !== null ? { label: "CVSS", value: primary.cvss.toFixed(1) } : null,
        primary.epss !== null ? { label: "EPSS", value: `${(primary.epss * 100).toFixed(1)}%` } : null,
        primary.in_kev ? { label: "KEV", value: primary.kev_due_date ? `截止 ${primary.kev_due_date}` : "已收录" } : null,
        data.pocRepos > 0 ? { label: "PoC 仓库", value: `${data.pocRepos}` } : null,
        data.scoring?.score !== null && data.scoring?.score !== undefined ? { label: "AI 评分", value: `${Math.round(data.scoring.score)}` } : null,
      ].filter((m): m is { label: string; value: string } => Boolean(m))
    : data.scoring?.score !== null && data.scoring?.score !== undefined
      ? [{ label: "AI 评分", value: `${Math.round(data.scoring.score)}` }]
      : [];

  const axes = [
    { label: "严重度", value: (primary?.cvss ?? 0) / 10 },
    { label: "预测利用", value: primary?.epss ?? 0 },
    { label: "已观测", value: data.maturity.wild || data.maturity.kev ? 1 : 0 },
    { label: "PoC", value: data.pocRepos === 0 ? 0 : data.pocRepos < 3 ? 0.5 : 1 },
    { label: "补丁", value: data.maturity.patched ? 1 : 0 },
  ];
  const hasRadar = primary?.cvss !== null && primary?.cvss !== undefined || (primary?.epss ?? null) !== null || data.pocRepos > 0;

  return (
    <div className="mt-7 rounded-card border border-line-soft bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-semibold text-ink-3">这一条的客观信号</div>
        <button type="button" onClick={report} className="text-[11.5px] text-ink-4 underline-offset-2 transition-colors hover:text-accent hover:underline">
          这条信息有误？
        </button>
      </div>

      {metrics.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {metrics.map((m) => (
            <Chip key={m.label} label={m.label} value={m.value} tone={m.label === "KEV" ? "border-hot/40 bg-hot-soft" : ""} />
          ))}
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        {STAGES.map((stage, index) => {
          const reached = data.maturity[stage.key];
          return (
            <span key={stage.key} className="inline-flex items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[11.5px] ${
                  reached ? "bg-accent text-accent-contrast" : "bg-bg-sunk text-ink-4"
                }`}
              >
                {stage.label}
              </span>
              {index < STAGES.length - 1 && <span className="text-ink-4">→</span>}
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {hasRadar && (
          <div className="shrink-0 text-ink-3">
            <Radar axes={axes} />
            <div className="mt-1 text-center text-[10.5px] leading-tight text-ink-4">由客观信号折算，不是模型打分</div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {data.cves.length > 0 && (
            <div className="text-[12.5px] text-ink-3">
              编号：
              {data.cves.map((cve, i) => (
                <span key={cve}>
                  {i > 0 && "、"}
                  <a href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noopener noreferrer" className="mono text-ink-2 underline-offset-2 hover:text-accent hover:underline">
                    {cve}
                  </a>
                </span>
              ))}
            </div>
          )}
          {primary?.repo_sample && primary.repo_sample.length > 0 && (
            <div className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
              GitHub 上提到它的仓库：
              {primary.repo_sample.map((repo) => (
                <a key={repo.url} href={repo.url} target="_blank" rel="noopener noreferrer" className="mono ml-1.5 text-ink-2 underline-offset-2 hover:text-accent hover:underline">
                  {repo.name}
                  <span className="text-ink-4"> ({repo.stars}★)</span>
                </a>
              ))}
            </div>
          )}
          {data.surface.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-ink-4">攻击面</span>
              {data.surface.map((s) => (
                <a
                  key={s.key}
                  href={`/all?tag=${encodeURIComponent(s.key)}`}
                  title={s.hint}
                  className="chip"
                >
                  {s.key}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.timeline.length > 1 && (
        <div className="mt-4 border-t border-line-soft pt-3">
          <div className="text-[12px] font-semibold text-ink-3">这件事的进展</div>
          <ol className="mt-2 space-y-1.5">
            {data.timeline.map((entry) => (
              <li key={entry.id} className="flex min-w-0 items-baseline gap-2 text-[12.5px]">
                <span className="mono shrink-0 text-ink-4">{entry.at ? new Date(entry.at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : "—"}</span>
                <a
                  href={`/items/${entry.id}`}
                  className={`min-w-0 truncate underline-offset-2 hover:underline ${entry.id === item.id ? "text-ink font-medium" : "text-ink-2"}`}
                >
                  {entry.title}
                </a>
                <span className="shrink-0 text-ink-4">{entry.source}</span>
                <span className="shrink-0 text-ink-4">{relative(entry.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
