// 网页插口：文章页上多一块「客观信号」（指标行、风险画像、进展时间线、攻击面、纠错入口）。
// 另外把纠错草稿接进引擎的反馈页：点「这条信息有误？」后，反馈页会读到这份草稿。
import type { WebModule } from "@aihot/web/modules";
import { SignalBlock } from "./web/signal-block.tsx";

const DRAFT_KEY = "vulnhot-correction";

interface Draft {
  content?: string;
  email?: string;
  pageUrl?: string;
}

export const vulnSignalsWeb: WebModule = {
  name: "vuln-signals",
  itemPage: async () => ({ default: { name: "客观信号", Block: SignalBlock } }),
  feedbackDraft: {
    read: (): Draft | null => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Draft;
        return typeof parsed?.content === "string" ? parsed : null;
      } catch {
        return null;
      }
    },
    clear: () => {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* 隐私模式下没有草稿 */
      }
    },
  },
};
