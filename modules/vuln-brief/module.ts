// 漏洞精读：给一条精选补上"背景三句话"和"小白也能看懂的精读六段"（modules/vuln-brief）。
// 只对满足触发条件的条目花钱（进 KEV / EPSS 高 / 有公开 PoC / 一手源 CVSS≥9 / 影响面命中）。
import { defineModule } from "@aihot/contracts/modules";

export const vulnBrief = defineModule({
  name: "vuln-brief",
  // 模块自己的读取接口，由 api 进程回答；网页开发服务器与生产 web 会把它们转给 api。
  apiPaths: [/^\/api\/site\/brief\//],
});
