// 网页插口：文章页上加一块"精读"（背景三句话 + 小白也能看懂的六段）。
import type { WebModule } from "@aihot/web/modules";
import { BriefBlock } from "./web/brief-block.tsx";

export const vulnBriefWeb: WebModule = {
  name: "vuln-brief",
  itemPage: async () => ({ default: { name: "精读", Block: BriefBlock } }),
};
