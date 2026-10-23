// 观测台顶部的数字块：一个标签、一个大数字、一句脚注，整块点到对应的页面去。
import { Link } from "react-router";

const TONES = {
  plain: "text-ink",
  hot: "text-hot",
  amber: "text-amber",
  ok: "text-ok",
  accent: "text-accent",
} as const;

export function StatTile({ label, value, unit, hint, to, tone = "plain" }: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  to?: string;
  tone?: keyof typeof TONES;
}) {
  const body = (
    <>
      <span className="text-[11.5px] font-medium tracking-wide text-ink-3">{label}</span>
      <span className="mt-1 flex items-baseline gap-1">
        <span className={`num text-[26px] font-semibold leading-none ${TONES[tone]}`}>{value}</span>
        {unit && <span className="text-[11.5px] text-ink-4">{unit}</span>}
      </span>
      {hint && <span className="mt-1.5 block truncate text-[11px] text-ink-4">{hint}</span>}
    </>
  );
  const shell = "flex min-w-0 flex-col rounded-tile border border-line bg-surface px-3.5 py-3 transition-colors";
  if (!to) return <div className={shell}>{body}</div>;
  return (
    <Link to={to} className={`${shell} hover:border-line-strong hover:bg-raised`}>
      {body}
    </Link>
  );
}
