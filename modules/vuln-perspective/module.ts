// 文章页上多出来的两段：红队视角、蓝队视角（modules/vuln-perspective）。
import { defineModule } from "@aihot/contracts/modules";

export const vulnPerspective = defineModule({
  name: "vuln-perspective",
  // 模块自己的读取接口，由 api 进程回答；网页开发服务器与生产 web 会把它们转给 api。
  apiPaths: [/^\/api\/site\/perspective\//],
});
