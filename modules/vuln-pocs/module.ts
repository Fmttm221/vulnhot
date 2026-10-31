// PoC 索引：把 pocindex 的公开利用索引内化成本站自己的两张表（CVE 清单 + 每个编号的仓库地址、
// Nuclei 模板、Metasploit 模块、ExploitDB 条目、Vulhub 环境）。搜索页在 /poc，单条在 /poc/:cve，
// 文章页上多一块「公开利用」。
import { defineModule } from "@aihot/contracts/modules";

export const vulnPocs = defineModule({
  name: "vuln-pocs",
  pages: [
    { path: "poc", file: "./web/pages/index.tsx", id: "poc-index" },
    { path: "poc/:cve", file: "./web/pages/detail.tsx", id: "poc-detail" },
  ],
  apiPaths: [/^\/api\/site\/pocs\//],
});
