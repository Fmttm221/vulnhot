// 网页插口：侧栏加一个「PoC 索引」入口（我的页也有），文章页上多一块「公开利用」。
import type { WebModule } from "@aihot/web/modules";
import { IconCode } from "@aihot/web/components/icons";
import { PocBlock } from "./web/poc-block.tsx";

export const vulnPocsWeb: WebModule = {
  name: "vuln-pocs",
  sidebar: { section: "内容", items: [{ to: "/poc", label: "PoC 索引", icon: IconCode }] },
  tools: [{ to: "/poc", label: "PoC 索引", icon: <IconCode size={20} /> }],
  itemPage: async () => ({ default: { name: "公开利用", Block: PocBlock } }),
};
