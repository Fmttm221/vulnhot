// 红蓝视角的提示词：模块自己的文件，改它不用改代码。{{siteName}} 在渲染时替换。
import { readFileSync } from "node:fs";
import path from "node:path";
import { SITE } from "@aihot/site";

const RAW = readFileSync(path.join(import.meta.dirname, "prompts/perspective.md"), "utf8");

export const PERSPECTIVE_SYSTEM = RAW.replaceAll("{{siteName}}", SITE.name);

export interface PerspectiveInput {
  title: string;
  summary: string | null;
  category: string | null;
  tags: string[];
  url: string;
  body: string | null;
  /** 这条同时生成了小白精读时走深度模式（更多条、更长、四必答）。 */
  deep: boolean;
  /** 我们自己抓的客观信号：有就引用，没有就不提。 */
  signals: string[];
  /** 同一事件里其他信源的报道：用来把材料拼厚，不只凭一条薄材料硬写。 */
  siblings: Array<{ source: string; title: string; summary: string }>;
}

/** 把一条资讯连同同一事件的其他报道、客观信号压成模型输入；正文截断，避免为一条资讯付费过多。 */
export function perspectiveUser(input: PerspectiveInput): string {
  const body = (input.body ?? "").trim();
  return [
    `【模式】\n${input.deep ? "deep" : "brief"}`,
    `【标题】\n${input.title}`,
    input.summary ? `【AI 摘要】\n${input.summary}` : "",
    input.category ? `【分类】\n${input.category}` : "",
    input.tags.length ? `【标签】\n${input.tags.join("、")}` : "",
    `【原文链接】\n${input.url}`,
    input.signals.length ? `【客观信号（我们自己抓的外部数据，可直接引用）】\n${input.signals.join("\n")}` : "",
    input.siblings.length
      ? `【同一事件的其他报道（只用它们补事实，不要复述）】\n${input.siblings
          .map((r) => `- ${r.source}：${r.title}${r.summary ? ` — ${r.summary.slice(0, 200)}` : ""}`)
          .join("\n")}`
      : "",
    body ? `【原文正文（截断）】\n${body.slice(0, input.deep ? 6000 : 4000)}` : "【原文正文】\n（本条未取到正文，只有标题与摘要）",
  ]
    .filter(Boolean)
    .join("\n\n");
}
