import { t as translate, ui } from "../lib/i18n";
// 观测台：一页看完收了多少、现在最该看什么。数字全部来自公开读取层（/api/site/observatory 等），
// 读者打开页面不触发任何模型调用。
import { Link, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/observatory";
import type { HotResponse, Observatory, SiteStats } from "@aihot/contracts/site";
import { CATEGORY_LABELS, type CategoryKey } from "@aihot/contracts/taxonomy";
import { cachedPage, loadOr404 } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { pageMeta, siteLd } from "../lib/seo";
import { monthDayTime } from "../lib/format";
import { StatTile } from "../features/observatory/StatTile";
import { BarList, type BarItem } from "../features/observatory/BarList";
import { FlowDiagram } from "../features/observatory/FlowDiagram";
import { HeatCurve } from "../features/observatory/HeatCurve";
import type { Screen } from "../components/shell/screens";
import { IconChevronRight } from "../components/icons";

export const handle: Screen = { tab: "observatory", name: "观测台" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

/** 时间窗口：标签 → 小时数，和 /api/site/observatory 认的列表一致。 */
const WINDOWS = [
  { hours: 1, label: "1 小时" },
  { hours: 6, label: "6 小时" },
  { hours: 24, label: "24 小时" },
  { hours: 72, label: "3 天" },
  { hours: 168, label: "7 天" },
  { hours: 720, label: "30 天" },
] as const;

/** 分类配色：优先用站点主题变量，浅色深色自动跟着走。 */
const CATEGORY_COLOR: Record<string, string> = {
  exploited: "var(--hot)",
  poc: "var(--amber)",
  advisory: "var(--accent)",
  "supply-chain": "#7c5cf0",
  incident: "var(--ok)",
};

/** 没打上分类的情报很多（CVE 原始记录、聚合站列表），单列成「未分类」而不是漏掉。 */
const labelOf = (category: string) => ui(category ? CATEGORY_LABELS[category as CategoryKey] ?? category : translate("未分类"));
const colorOf = (category: string) => (category ? CATEGORY_COLOR[category] ?? "var(--ink-3)" : "var(--line-strong)");

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  // 观测台没有搜索框；带 q 的首页链接照旧交给搜索页，老链接不会白点。
  const q = url.searchParams.get("q");
  if (q && q.trim()) throw redirect(`/all${url.search}`);
  const asked = Number(url.searchParams.get("window") ?? 168);
  const hours = WINDOWS.some((w) => w.hours === asked) ? asked : 168;
  // 观测台这一份是必须的；统计与热点只是补充，读不到也要把台账画出来。
  // 上流的缓存头要带进页面：读者看到的新鲜度和接口一致，不是页面自己另算一个。
  const upstream = new Headers();
  const [observatory, stats, hot] = await Promise.all([
    loadOr404<Observatory>(`/api/site/observatory?window=${hours}`, { responseHeaders: upstream, signal: request.signal }),
    loadOr404<SiteStats>("/api/site/stats", { signal: request.signal }).catch(() => null),
    loadOr404<HotResponse>("/api/site/hot", { signal: request.signal }).catch(() => null),
  ]);
  return cachedPage(120, { observatory, stats, hot, hours }, upstream);
}

export function meta() {
  return pageMeta({
    title: translate("观测台"),
    description: translate("全球漏洞情报的聚合概览：信源到分类的流向、分类分布、热度曲线，以及现在最该看的几条。"),
    path: "/",
    // 首页承担站点级的机器描述（组织、站点、数据集）；精选页只加自己的条目清单。
    jsonLd: siteLd(),
  });
}

export default function ObservatoryPage() {
  const { observatory, stats, hot, hours } = useLoaderData<typeof loader>();
  const { totals, sources, flow, categories, heat } = observatory;
  const entries = hot?.entries ?? [];
  const latest = stats?.latest ?? [];
  const window = WINDOWS.find((w) => w.hours === hours)!;

  const bars: BarItem[] = categories.map((c) => ({
    key: c.category,
    label: labelOf(c.category),
    count: c.count,
    color: colorOf(c.category),
    to: c.category ? `/all?category=${c.category}` : "/all",
  }));

  return (
    <div className="mx-auto max-w-[var(--page-max-wide)] pb-14 pt-5">
      {/* 标题 + 时间窗口 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">{translate("观测台")}</h1>
          <p className="mt-1 text-[12.5px] text-ink-4">
            {translate("{0}窗口 · 信源 {1}/{2} 在跑 · 读者打开页面不调用模型", [ui(window.label), sources.enabled, sources.total])}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-1 rounded-control border border-line bg-surface p-1" aria-label={translate("时间窗口")}>
          {WINDOWS.map((w) => (
            <Link
              key={w.hours}
              to={w.hours === 168 ? "/" : `/?window=${w.hours}`}
              className={`rounded-mark px-2.5 py-1 text-[12px] transition-colors ${w.hours === hours ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-3 hover:bg-well hover:text-ink"}`}
            >
              {ui(w.label)}
            </Link>
          ))}
        </nav>
      </div>

      {/* 数字条 */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label={translate("情报总数")} value={String(totals.items)} unit={translate("条")} hint={translate("精选 {0} 条", [totals.selected])} to="/all" />
        <StatTile label={translate("24 小时新增")} value={String(totals.items24h)} unit={translate("条")} hint={translate("按收录时间算")} to="/all" tone={totals.items24h > 0 ? "accent" : "plain"} />
        <StatTile label={translate("事件")} value={String(totals.stories)} unit={translate("个")} hint={translate("同一件事的多方报道归一个")} to="/hot" />
        <StatTile label={translate("KEV 条目")} value={String(totals.kev)} unit={translate("个 CVE")} hint={translate("CISA 已知被利用目录")} tone={totals.kev > 0 ? "hot" : "plain"} />
        <StatTile
          label={translate("信源健康")}
          value={`${sources.enabled}/${sources.total}`}
          hint={sources.failing > 0 ? translate("异常 {0} 个", [sources.failing]) : translate("全部正常")}
          tone={sources.failing > 0 ? "amber" : "ok"}
        />
        <StatTile label={translate("日报")} value={String(totals.dailies)} unit={translate("期")} hint={translate("每天 08:00 出刊")} to="/daily" />
      </div>

      {/* 流向图 + 分类分布 */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-panel border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">{translate("信源 → 分类")}</h2>
            <span className="text-[11px] text-ink-4">{translate("带宽按情报条数加权 · 悬停看具体流量")}</span>
          </header>
          {/* 手机上横向滚动：缩到 350px 宽时标签会看不清，宁可让这一块自己滚。 */}
          <div className="overflow-x-auto px-2 py-2 [scrollbar-width:thin]">
            <FlowDiagram
              links={flow}
              labelOf={labelOf}
              colorOf={colorOf}
              emptyText={translate("这个窗口里还没有被收录的情报")}
            />
          </div>
        </section>

        <section className="min-w-0 rounded-panel border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">{translate("分类分布")}</h2>
            <span className="text-[11px] text-ink-4">{translate("共 {0} 个分类", [categories.length])}</span>
          </header>
          <BarList items={bars} />
          <div className="border-t border-line">
            <header className="flex items-center justify-between gap-3 px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">{translate("发布热度")}</h2>
              <span className="text-[11px] text-ink-4">{translate("每小时")}</span>
            </header>
            <HeatCurve points={heat} />
          </div>
        </section>
      </div>

      {/* 热点事件 + 最新精选 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-panel border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">{translate("热点事件 Top {0}", [Math.min(8, entries.length)])}</h2>
            <Link to="/hot" className="flex items-center gap-0.5 text-[11.5px] text-ink-4 hover:text-accent">{translate("完整榜单")}<IconChevronRight size={12} />
            </Link>
          </header>
          <ol className="divide-y divide-line-soft">
            {entries.slice(0, 8).map((entry) => (
              <li key={entry.story.publicId}>
                <Link to={`/story/${entry.story.publicId}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-well">
                  <span className={`num mt-0.5 w-4 shrink-0 text-[13px] font-semibold ${entry.rank <= 3 ? "text-hot" : "text-ink-4"}`}>{entry.rank}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">{entry.story.title}</span>
                    <span className="mt-1 block truncate text-[11.5px] text-ink-4">
                      {entry.sourceNames.slice(0, 3).join("、")}
                      {entry.sourceCount > 3 ? translate(" 等 {0} 个来源", [entry.sourceCount]) : ""}
                    </span>
                  </span>
                  <span className="num shrink-0 text-[12px] tabular-nums text-ink-3">{Math.round(entry.heat)}</span>
                </Link>
              </li>
            ))}
            {entries.length === 0 && <li className="px-4 py-8 text-center text-[12.5px] text-ink-4">{translate("过去 48 小时还没有形成热点")}</li>}
          </ol>
        </section>

        <section className="rounded-panel border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">{translate("最新精选")}</h2>
            <Link to="/featured" className="flex items-center gap-0.5 text-[11.5px] text-ink-4 hover:text-accent">{translate("情报流")}<IconChevronRight size={12} />
            </Link>
          </header>
          <ol className="divide-y divide-line-soft">
            {latest.map((item) => (
              <li key={item.id}>
                <Link to={`/items/${item.id}`} className="block px-4 py-2.5 hover:bg-well">
                  <span className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">{item.title}</span>
                  <span className="mt-1 block truncate text-[11.5px] text-ink-4">{item.source}</span>
                </Link>
              </li>
            ))}
            {latest.length === 0 && <li className="px-4 py-8 text-center text-[12.5px] text-ink-4">{translate("还没有入选内容")}</li>}
          </ol>
        </section>
      </div>

      <p className="mt-4 text-[11.5px] text-ink-4">{translate("数据生成于 {0} · 窗口内共 {1} 条流向记录", [monthDayTime(observatory.generatedAt), flow.reduce((sum, l) => sum + l.count, 0)])}</p>
    </div>
  );
}
