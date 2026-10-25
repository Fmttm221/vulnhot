import { t, ui } from "../../lib/i18n.ts";
// Names, dates and grouping for daily, weekly and monthly reports.
import { REPORT_NAMES, type ReportNavigationEntry, type ReportKind } from "@aihot/contracts/site";
import { beijingDate, isoWeekLabel, isoWeekRange } from "@aihot/contracts/time";
import { displayWeekday as beijingWeekday, displayMonthDay as monthDay } from "../../lib/format.ts";
import { EDITION_WHEN as SOURCE_EDITION_WHEN, REPORTS as SOURCE_REPORTS, SITE as SOURCE_SITE, subjectAfter } from "@aihot/site";
import { RELEASE } from "@aihot/industry/taxonomy";
import { weekdayShort } from "../../lib/format.ts";
import { currentLocale } from '../../lib/locale.ts';

const EDITION_WHEN = SOURCE_EDITION_WHEN;
const REPORTS = SOURCE_REPORTS;
const SITE = SOURCE_SITE;


export const KINDS: ReportKind[] = ["daily", "weekly", "monthly"];
export const KIND_PATH: Record<ReportKind, string> = { daily: "/daily", weekly: "/weekly", monthly: "/monthly" };

export function kindFromPath(pathname: string): ReportKind {
  if (pathname.startsWith("/weekly")) return "weekly";
  if (pathname.startsWith("/monthly")) return "monthly";
  return "daily";
}

/** The kind's RSS feed, announced in the page head so a reader given the page finds it. */
export const feedLink = (kind: ReportKind) => ({ tagName: "link", rel: "alternate", type: "application/rss+xml", title: `${SITE.name} ${REPORT_NAMES[kind]}`, href: `/feed/${kind}.xml` }) as const;

export function reportPath(kind: ReportKind, key: string): string {
  return `${KIND_PATH[kind]}/${key}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

const { measure, noun } = REPORTS.entry;
/** "件大事": what an issue counts its entries in, in the site's words (REPORTS.entry). */
export const ENTRIES_UNIT = `${measure}${noun}`;

/** "这一天的 4 件 AI 大事" / "本周的 12 件 AI 大事" / "8 月的 20 件 AI 大事" (the subject and REPORTS.entry from site/site.ts). */
export function headline(kind: ReportKind, key: string, count: number): string {
  if (kind === "daily") return ui(subjectAfter(t("这一天的 {0} {1}", [count, measure]), noun));
  if (kind === "weekly") return ui(subjectAfter(t("本周的 {0} {1}", [count, measure]), noun));
  return ui(subjectAfter(t("{0} 月的 {1} {2}", [Number(key.slice(5, 7)), count, measure]), noun));
}

/** "09.16" for a story inside a week or month. */
export function shortDay(iso: string): string {
  return beijingDate(iso).slice(5).replace("-", ".");
}

export interface ArchiveGroup {
  id: string;
  label: string;
  entries: Array<ReportNavigationEntry & { short: string }>;
}

/**
 * The archive column: days grouped by month, weeks by the month their Monday falls in ("第2周"),
 * months by year. Newest first, as the index comes.
 */
export function archiveGroups(kind: ReportKind, index: ReportNavigationEntry[]): ArchiveGroup[] {
  const groups: ArchiveGroup[] = [];
  const push = (id: string, label: string, e: ReportNavigationEntry & { short: string }) => {
    const g = groups[groups.length - 1];
    if (g && g.id === id) g.entries.push(e);
    else groups.push({ id, label, entries: [e] });
  };
  if (kind === "weekly") {
    const byMonth = new Map<string, string[]>();
    for (const e of index) {
      const m = isoWeekRange(e.key)!.start.slice(0, 7);
      byMonth.set(m, [...(byMonth.get(m) ?? []), e.key]);
    }
    for (const e of index) {
      const m = isoWeekRange(e.key)!.start.slice(0, 7);
      const weeks = [...byMonth.get(m)!].sort();
      push(m, t("{0} 年 {1} 月", [m.slice(0, 4), Number(m.slice(5))]), { ...e, short: t("第{0}周", [weeks.indexOf(e.key) + 1]) });
    }
    return groups;
  }
  for (const e of index) {
    if (kind === "daily") push(e.key.slice(0, 7), t("{0} 年 {1} 月", [e.key.slice(0, 4), Number(e.key.slice(5, 7))]), { ...e, short: t("{0} 日", [Number(e.key.slice(8, 10))]) });
    else push(e.key.slice(0, 4), t("{0} 年", [e.key.slice(0, 4)]), { ...e, short: t("{0} 月", [Number(e.key.slice(5, 7))]) });
  }
  return groups;
}

/** An issue's mark in the archive column: a large number over a small word (a month's number stands alone). */
export function archiveMark(kind: ReportKind, key: string): { big: string; small: string | null } {
  if (kind === "daily") return { big: key.slice(8, 10), small: weekdayShort(key) };
  if (kind === "weekly") {
    const { start } = isoWeekRange(key)!;
    return { big: key.slice(6), small: t("{0}.{1} 起", [Number(start.slice(5, 7)), Number(start.slice(8, 10))]) };
  }
  return { big: key.slice(5, 7), small: null };
}

/** Short chip label for the phone switcher: "今天", "9月26日", "9月第2周", "8 月". */
export function chipLabel(kind: ReportKind, key: string, index: ReportNavigationEntry[], today: string): string {
  if (kind === "daily") return key === today ? t("今天") : monthDay(key);
  if (kind === "monthly") return t("{0} 月", [Number(key.slice(5, 7))]);
  const group = archiveGroups("weekly", index).find((g) => g.entries.some((e) => e.key === key));
  const entry = group?.entries.find((e) => e.key === key);
  return group && entry ? t("{0}月{1}", [Number(group.id.slice(5)), entry.short]) : key;
}

/**
 * "第 N 期": the issue's place in its series as the server counts it over every issue. The navigation
 * index holds only the newest issues, so its length cannot tell.
 */
export function issueNumber(index: ReportNavigationEntry[], key: string): number | null {
  return index.find((e) => e.key === key)?.issueNumber ?? null;
}

/** The masthead's date block: a large figure and two small lines beside it. */
export function dateMark(kind: ReportKind, key: string): { figure: string; top: string; bottom: string } {
  if (kind === "daily") return { figure: key.slice(8, 10), top: t("{0} 年 {1} 月", [key.slice(0, 4), Number(key.slice(5, 7))]), bottom: beijingWeekday(key) };
  if (kind === "weekly") {
    const { start, end } = isoWeekRange(key)!;
    return { figure: key.slice(6), top: t("{0} 年第 {1} 周", [key.slice(0, 4), Number(key.slice(6))]), bottom: `${start.slice(5).replace("-", ".")} — ${end.slice(5).replace("-", ".")}` };
  }
  return { figure: key.slice(5, 7), top: t("{0} 年", [key.slice(0, 4)]), bottom: t("{0} 月", [Number(key.slice(5, 7))]) };
}

/** When each kind comes out, for the masthead (the times are the site's, EDITION_WHEN). */
export const EDITION: Record<ReportKind, string> = { daily: `${EDITION_WHEN.daily} 出刊`, weekly: "每周一出刊", monthly: "每月 1 日出刊" };

/**
 * The masthead's figures, in the order a reader wants them, in the site's words (REPORTS). Releases of the
 * pack's headline launch kind (RELEASE, "个新模型" for AI) count only where the pack has one; zero is left out.
 */
const UNITS = REPORTS.metricUnits;
const METRICS: Array<[key: string, unit: string]> = [
  ["totalEvents", ENTRIES_UNIT],
  ["totalStories", ENTRIES_UNIT],
  ["sourcesCount", UNITS.sourcesCount],
  ["firstPartyEvents", UNITS.firstPartyEvents],
  ...(RELEASE ? [["modelsReleased", RELEASE.unit] as [string, string]] : []),
  ["selectedCount", UNITS.selectedCount],
  ["reportsCovered", UNITS.reportsCovered],
];
export function metricItems(metrics: Record<string, number>): Array<{ value: number; unit: string }> {
  return METRICS.filter(([k]) => typeof metrics[k] === "number" && (k !== "modelsReleased" || metrics[k]! > 0)).map(([k, unit]) => ({ value: metrics[k]!, unit }));
}

/** "前一日 · 9月25日", "上一期 · 第 37 周", "下一期 · 7 月". */
export function neighbourLabel(kind: ReportKind, key: string, direction: "prev" | "next"): string {
  if (kind === "daily") return `${direction === "prev" ? t("前一日") : t("后一日")} · ${monthDay(key)}`;
  const which = direction === "prev" ? t("上一期") : t("下一期");
  return kind === "weekly" ? t("{0} · 第 {1} 周", [which, Number(key.slice(6))]) : t("{0} · {1} 月", [which, Number(key.slice(5, 7))]);
}

const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
/** Page numbers as a Chinese paper prints them: 1 → 一, 12 → 十二, 20 → 二十. */
function cnNumber(n: number): string {
  if (currentLocale() === 'en') return String(n);
  if (n <= 10) return CN[n]!;
  if (n < 20) return t("十{0}", [CN[n - 10]]);
  return t("{0}十{1}", [CN[Math.floor(n / 10)], n % 10 ? CN[n % 10] : ""]);
}

/** The line above the nameplate: "2026 年 9 月 26 日 · 星期六", "2026 年第 38 周 · 09.14 — 09.20", "2026 年 8 月". */
export function dateLine(kind: ReportKind, key: string): string {
  const m = dateMark(kind, key);
  if (kind === "daily") return t("{0} {1} 日 · {2}", [m.top, Number(key.slice(8, 10)), m.bottom]);
  return kind === "weekly" ? `${m.top} · ${m.bottom}` : `${m.top} ${m.bottom}`;
}

/** What each kind is, under its nameplate. */
export const MOTTO: Record<ReportKind, string> = { daily: `${REPORTS.motto} · 每日要闻`, weekly: `${REPORTS.motto} · 每周综述`, monthly: `${REPORTS.motto} · 每月盘点` };

export interface PeriodCell {
  key: string | null;
  /** Hover text: "9月26日 · 第 158 期". */
  label: string;
  state: "current" | "issue" | "none" | "pad";
}

/**
 * The dot grid beside the date in the masthead: the days of this issue's month (dailies, Monday first),
 * the weeks of its year (weeklies) or the months of its year (monthlies), each marked as this issue,
 * an issue that exists, or none. This issue's own number (`current`) labels it, also when it is older
 * than the navigation.
 */
export function periodGrid(kind: ReportKind, key: string, index: ReportNavigationEntry[], current: number): { title: string; note: string; columns: number; heads: string[] | null; cells: PeriodCell[] } {
  const exists = new Set(index.map((e) => e.key));
  const cell = (k: string, name: string): PeriodCell => {
    const n = k === key ? current : issueNumber(index, k);
    return { key: k, label: n ? t("{0} · 第 {1} 期", [name, n]) : t("{0} · 未出刊", [name]), state: k === key ? "current" : exists.has(k) ? "issue" : "none" };
  };
  const count = (cells: PeriodCell[]) => cells.filter((c) => c.state === "issue" || c.state === "current").length;
  const year = key.slice(0, 4);
  if (kind === "daily") {
    const m = Number(key.slice(5, 7));
    const days = new Date(Date.UTC(Number(year), m, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(Number(year), m - 1, 1)).getUTCDay() + 6) % 7;
    const cells: PeriodCell[] = [
      ...Array.from({ length: lead }, (): PeriodCell => ({ key: null, label: "", state: "pad" })),
      ...Array.from({ length: days }, (_, i) => {
        const day = `${key.slice(0, 7)}-${pad(i + 1)}`;
        return cell(day, monthDay(day));
      }),
    ];
    return { title: t("{0}月", [cnNumber(m)]), note: t("本月 {0} 期", [count(cells)]), columns: 7, heads: [t("一"), t("二"), t("三"), t("四"), t("五"), t("六"), t("日")], cells };
  }
  if (kind === "weekly") {
    // 28 December always falls in its year's last ISO week.
    const weeks = Number(isoWeekLabel(`${year}-12-28`).slice(6));
    const cells = Array.from({ length: weeks }, (_, i) => {
      const k = `${year}-W${pad(i + 1)}`;
      const { start, end } = isoWeekRange(k)!;
      return cell(k, t("第 {0} 周（{1}—{2}）", [i + 1, start.slice(5).replace("-", "."), end.slice(5).replace("-", ".")]));
    });
    return { title: t("{0} 年", [year]), note: t("全年 {0} 期", [count(cells)]), columns: 13, heads: null, cells };
  }
  const cells = Array.from({ length: 12 }, (_, i) => cell(`${year}-${pad(i + 1)}`, t("{0} 月", [i + 1])));
  return { title: t("{0} 年", [year]), note: t("全年 {0} 期", [count(cells)]), columns: 6, heads: null, cells };
}
