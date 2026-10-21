// 网页插口：文章页上多两块（红队视角 / 蓝队视角）。
import type { WebModule } from "@aihot/web/modules";
import { PerspectiveBlock } from "./web/perspective-block.tsx";

export const vulnPerspectiveWeb: WebModule = {
  name: "vuln-perspective",
  itemPage: async () => ({ default: { name: "攻防视角", Block: PerspectiveBlock } }),
};
