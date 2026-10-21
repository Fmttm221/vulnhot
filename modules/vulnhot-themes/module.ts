// 本站的额外配色：黑客（幽灵绿）/ 白客（白帽蓝）。页面在 /appearance。
import { defineModule } from "@aihot/contracts/modules";

export const vulnhotThemes = defineModule({
  name: "vulnhot-themes",
  pages: [{ path: "appearance", file: "./web/appearance.tsx", id: "appearance" }],
});
