import { t as translate, ui } from "../../lib/i18n";
// 横向条形榜单：分类分布、任何「名字 + 数量」的排行都能用。
import { Link } from "react-router";

export interface BarItem {
  key: string;
  label: string;
  count: number;
  /** 条形颜色，用 CSS 颜色值；不给按分类默认色。 */
  color?: string;
  to?: string;
}

export function BarList({ items, emptyText = translate("这个窗口里还没有内容") }: { items: BarItem[]; emptyText?: string }) {
  if (items.length === 0) return <p className="px-4 py-8 text-center text-[12.5px] text-ink-4">{ui(emptyText)}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2 px-4 py-3">
      {items.map((item) => {
        const row = (
          <>
            <span className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="truncate text-[12.5px] text-ink-2">{ui(item.label)}</span>
              <span className="num shrink-0 text-[12px] tabular-nums text-ink-4">{item.count}</span>
            </span>
            <span className="mt-1 block h-[6px] overflow-hidden rounded-full bg-well">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(2, Math.round((item.count / max) * 100))}%`, background: item.color ?? "var(--accent)" }}
              />
            </span>
          </>
        );
        return (
          <li key={item.key} className="block">
            {item.to
              ? <Link to={item.to} className="block rounded-control px-1 py-0.5 hover:bg-well">{row}</Link>
              : <span className="block px-1 py-0.5">{row}</span>}
          </li>
        );
      })}
    </ul>
  );
}
