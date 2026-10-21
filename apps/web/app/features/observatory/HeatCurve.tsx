// 窗口内的发布热度曲线：每小时一条，面积图。没有数据时画一条基线，不留空洞。
export interface HeatPoint { at: string; count: number }

const W = 1000;
const H = 132;
const PAD = 6;

/** "2026-10-21T14:00" → "14:00"；跨天时带上日期。 */
function tick(at: string): string {
  const [, time = ""] = at.split("T");
  return time.slice(0, 5);
}

export function HeatCurve({ points }: { points: HeatPoint[] }) {
  if (points.length === 0) return <p className="px-4 py-10 text-center text-[12.5px] text-ink-4">这个窗口里还没有发布</p>;
  const max = Math.max(...points.map((p) => p.count), 1);
  const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const x = (index: number) => PAD + index * step;
  const y = (count: number) => H - PAD - (count / max) * (H - PAD * 2 - 14);
  const line = points.map((p, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(p.count).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${H - PAD} L ${PAD} ${H - PAD} Z`;
  const peak = points.reduce((best, p, index) => (p.count > points[best]!.count ? index : best), 0);

  return (
    <div className="px-3 pb-2 pt-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[132px] w-full" preserveAspectRatio="none" role="img" aria-label="发布热度曲线">
        <defs>
          <linearGradient id="heat-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--line)" strokeWidth="1" />
        <path d={area} fill="url(#heat-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(peak)} cy={y(points[peak]!.count)} r="2.6" fill="var(--accent)" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10.5px] text-ink-4">
        <span className="num">{tick(points[0]!.at)}</span>
        <span className="num">峰值 {max} 条/小时</span>
        <span className="num">{tick(points[points.length - 1]!.at)}</span>
      </div>
    </div>
  );
}
