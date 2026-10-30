// 漏洞精读：精选里的漏洞打开后，先"认名字"（Drupal Core 这类名字逐个解释），再给"背景三句话"
// 和"小白也能看懂的精读六段"（modules/vuln-brief）。
// 只对带 CVE 编号、且精选评分 ≥ 60 的条目花钱，一天还有总量上限。
import { defineModule } from "@aihot/contracts/modules";

export const vulnBrief = defineModule({
  name: "vuln-brief",
  // 模块自己的读取接口，由 api 进程回答；网页开发服务器与生产 web 会把它们转给 api。
  apiPaths: [/^\/api\/site\/brief\//],
});
