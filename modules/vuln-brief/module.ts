// 精读：每条精选打开后，给一篇不懂安全的人也读得懂的短文（名字就地解释、重点标色），
// 后面跟可执行的自查与处置（modules/vuln-brief）。不限漏洞——被投毒、泄露这类事件同样要写。
// 只给最近入选、还没写过的新精选花钱，一天还有总量上限。
import { defineModule } from "@aihot/contracts/modules";

export const vulnBrief = defineModule({
  name: "vuln-brief",
  // 模块自己的读取接口，由 api 进程回答；网页开发服务器与生产 web 会把它们转给 api。
  apiPaths: [/^\/api\/site\/brief\//],
});
