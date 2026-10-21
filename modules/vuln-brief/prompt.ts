// 精读的提示词：模块自己的文件，改它不用改代码。{{siteName}} 在渲染时替换。
import { readFileSync } from "node:fs";
import path from "node:path";
import { SITE } from "@aihot/site";

const RAW = readFileSync(path.join(import.meta.dirname, "prompts/brief.md"), "utf8");

export const BRIEF_SYSTEM = RAW.replaceAll("{{siteName}}", SITE.name);

export interface SiblingReport {
  source: string;
  title: string;
  summary: string;
}

export interface BriefSignals {
  cves: string[];
  cvss: number | null;
  epss: number | null;
  inKev: boolean;
  kevDue: string | null;
  pocRepos: number | null;
  pocSample: string[];
}

export interface BriefInput {
  title: string;
  summary: string | null;
  category: string | null;
  tags: string[];
  url: string;
  body: string | null;
  signals: BriefSignals;
  siblings: SiblingReport[];
}

const pct = (v: number | null) => (v === null ? "未知" : `${Math.round(v * 1000) / 10}%`);

/** 把一条资讯连同它的客观信号、同事件的其它报道压成模型输入；正文截断，避免为一条资讯付费过多。 */
export function briefUser(input: BriefInput): string {
  const s = input.signals;
  const body = (input.body ?? "").trim();
  const signalLines = [
    `CVE：${s.cves.length ? s.cves.join("、") : "材料里没有编号"}`,
    `CVSS：${s.cvss ?? "未知"}`,
    `EPSS（未来 30 天被利用概率）：${pct(s.epss)}`,
    `CISA KEV：${s.inKev ? `在册${s.kevDue ? `，修复截止 ${s.kevDue}` : ""}` : "不在册"}`,
    `GitHub 上提到该编号的仓库数：${s.pocRepos ?? "未统计"}${s.pocSample.length ? `（如 ${s.pocSample.slice(0, 3).join("、")}）` : ""}`,
  ];
  return [
    `【标题】\n${input.title}`,
    input.summary ? `【AI 摘要】\n${input.summary}` : "",
    input.category ? `【分类】\n${input.category}` : "",
    input.tags.length ? `【标签】\n${input.tags.join("、")}` : "",
    `【原文链接】\n${input.url}`,
    `【客观信号（我们自己抓的外部数据，可直接引用）】\n${signalLines.join("\n")}`,
    input.siblings.length
      ? `【同一事件的其他报道（只用它们补事实，不要复述）】\n${input.siblings
          .map((r) => `- ${r.source}：${r.title}${r.summary ? ` — ${r.summary.slice(0, 200)}` : ""}`)
          .join("\n")}`
      : "",
    body ? `【原文正文（截断）】\n${body.slice(0, 6000)}` : "【原文正文】\n（本条未取到正文，只有标题与摘要；材料很少时，多写 caveats，不要补编）",
  ]
    .filter(Boolean)
    .join("\n\n");
}
