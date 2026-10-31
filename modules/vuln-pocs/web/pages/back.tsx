import { t as translate } from "@aihot/web/lib/i18n";
// 单条页左上角的返回：回到 PoC 索引。
import { Link } from "react-router";
import { IconArrowLeft } from "@aihot/web/components/icons";

export function ArrowBack() {
  return (
    <Link to="/poc" className="inline-flex h-8 items-center gap-1.5 rounded-full px-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink">
      <IconArrowLeft size={16} />
      {translate("PoC 索引")}
    </Link>
  );
}
