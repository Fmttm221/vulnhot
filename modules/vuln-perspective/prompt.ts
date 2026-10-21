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
}

/** 把一条资讯压成模型输入；正文截断，避免为一条资讯付费过多。 */
export function perspectiveUser(input: PerspectiveInput): string {
  const body = (input.body ?? "").trim();
  return [
    `【标题】\n${input.title}`,
    input.summary ? `【AI 摘要】\n${input.summary}` : "",
    input.category ? `【分类】\n${input.category}` : "",
    input.tags.length ? `【标签】\n${input.tags.join("、")}` : "",
    `【原文链接】\n${input.url}`,
    body ? `【原文正文（截断）】\n${body.slice(0, 4000)}` : "【原文正文】\n（本条未取到正文，只有标题与摘要）",
  ]
    .filter(Boolean)
    .join("\n\n");
}
