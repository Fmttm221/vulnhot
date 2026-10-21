// 客观风险信号：CVSS/EPSS/KEV 三值、GitHub 上的 PoC 仓库计数、以及一条资讯的进展时间线。
import { defineModule } from "@aihot/contracts/modules";

export const vulnSignals = defineModule({
  name: "vuln-signals",
  apiPaths: [/^\/api\/site\/signals\//],
});
