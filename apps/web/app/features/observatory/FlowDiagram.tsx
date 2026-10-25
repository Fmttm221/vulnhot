import { t as translate, ui } from "../../lib/i18n";
// 信源 → 分类 的流向图：左边每个信源一条，右边每个分类一条，中间的带宽是「这个信源在这个分类里有多少条」。
// 纯 SVG，不引入图表库；颜色取站点自己的主题变量，浅色深色都跟着变。
import { useMemo, useState } from "react";

export interface FlowLink {
  source: string;
  category: string;
  count: number;
}

const W = 1000;
const H = 680;
const PAD_Y = 8;
const GAP = 8;
const LEFT_X = 168;
const RIGHT_X = W - 168;
const BAR_W = 10;
const MIN_NODE = 9;
const MAX_SOURCES = 8;
const LABEL_GAP = 13;
const MAX_LABEL = 18;

interface Node { key: string; label: string; count: number; y: number; h: number }

function stack(items: Array<{ key: string; label: string; count: number }>, total: number): Node[] {
  const usable = H - PAD_Y * 2 - GAP * Math.max(0, items.length - 1);
  const scale = usable / Math.max(total, 1);
  const heights = items.map((i) => Math.max(MIN_NODE, i.count * scale));
  const overflow = heights.reduce((a, b) => a + b, 0) - usable;
  const shrink = overflow > 0 ? overflow / heights.length : 0;
  let y = PAD_Y;
  return items.map((item, index) => {
    const h = Math.max(MIN_NODE, heights[index]! - shrink);
    const node = { ...item, y, h };
    y += h + GAP;
    return node;
  });
}

/** 节点太小的时候标签会叠在一起：按顺序往下推，整列放不下就整体上移。 */
function labelRows(nodes: Node[]): Map<string, number> {
  const rows = [...nodes].sort((a, b) => a.y - b.y).map((n) => ({ key: n.key, y: n.y + n.h / 2 }));
  let cursor = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    row.y = Math.max(row.y, cursor + LABEL_GAP);
    cursor = row.y;
  }
  const last = rows[rows.length - 1];
  if (last) {
    const overflow = last.y + LABEL_GAP / 2 - (H - 2);
    if (overflow > 0) for (const row of rows) row.y -= overflow;
  }
  const first = rows[0];
  if (first) {
    const lift = 8 - first.y;
    if (lift > 0) for (const row of rows) row.y += lift;
  }
  return new Map(rows.map((row) => [row.key, row.y]));
}

/** 长信源名截断，标签不会跑出画布。 */
function clamp(text: string): string {
  return text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text;
}

function ribbon(x1: number, y1: number, h1: number, x2: number, y2: number, h2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}
    L ${x2} ${y2 + h2} C ${mx} ${y2 + h2}, ${mx} ${y1 + h1}, ${x1} ${y1 + h1} Z`;
}

export function FlowDiagram({ links, labelOf, colorOf, emptyText }: {
  links: FlowLink[];
  labelOf: (category: string) => string;
  colorOf: (category: string) => string;
  emptyText: string;
}) {
  const [hover, setHover] = useState<{ kind: "source" | "category" | "link"; key: string } | null>(null);

  const layout = useMemo(() => {
    const bySource = new Map<string, number>();
    const byCategory = new Map<string, number>();
    for (const link of links) {
      bySource.set(link.source, (bySource.get(link.source) ?? 0) + link.count);
      byCategory.set(link.category, (byCategory.get(link.category) ?? 0) + link.count);
    }
    const sortedSources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
    const kept = sortedSources.slice(0, MAX_SOURCES);
    const restTotal = sortedSources.slice(MAX_SOURCES).reduce((sum, [, n]) => sum + n, 0);
    const sourceRows = kept.map(([name, count]) => ({ key: name, label: name, count }));
    if (restTotal > 0) sourceRows.push({ key: "__rest__", label: translate("其他 {0} 个信源", [sortedSources.length - MAX_SOURCES]), count: restTotal });

    const total = sourceRows.reduce((sum, r) => sum + r.count, 0);
    const categories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, label: labelOf(key), count }));

    const sourceNodes = stack(sourceRows, total);
    const categoryNodes = stack(categories, total);

    const sourceOffset = new Map(sourceNodes.map((n) => [n.key, n.y]));
    const categoryOffset = new Map(categoryNodes.map((n) => [n.key, n.y]));
    const scale = (H - PAD_Y * 2 - GAP * Math.max(0, sourceNodes.length - 1)) / Math.max(total, 1);

    const paths = links.map((link) => {
      const bucket = kept.some(([name]) => name === link.source) ? link.source : "__rest__";
      const category = link.category;
      const from = sourceOffset.get(bucket) ?? PAD_Y;
      const to = categoryOffset.get(category) ?? PAD_Y;
      const h = Math.max(1, link.count * scale);
      const path = { bucket, category, count: link.count, h };
      sourceOffset.set(bucket, from + h);
      categoryOffset.set(category, to + h);
      return path;
    });

    return { sourceNodes, categoryNodes, paths, total, scale };
  }, [links, labelOf]);

  if (layout.total === 0) {
    return <p className="px-4 py-14 text-center text-[12.5px] text-ink-4">{ui(emptyText)}</p>;
  }

  const leftRows = labelRows(layout.sourceNodes);
  const rightRows = labelRows(layout.categoryNodes);

  const dim = (bucket: string, category: string) => {
    if (!hover) return false;
    if (hover.kind === "category") return hover.key !== category;
    return hover.key !== bucket;
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[680px] select-none" role="img" aria-label={translate("信源到分类的流向图")}>
        {layout.paths.map((path, index) => {
          const sourceNode = layout.sourceNodes.find((n) => n.key === path.bucket);
          const categoryNode = layout.categoryNodes.find((n) => n.key === path.category);
          if (!sourceNode || !categoryNode) return null;
          // 每个节点内部的纵向偏移：按已画过的同类/同源流量累加。
          const sameBucketBefore = layout.paths.slice(0, index).filter((p) => p.bucket === path.bucket).reduce((s, p) => s + p.h, 0);
          const sameCategoryBefore = layout.paths.slice(0, index).filter((p) => p.category === path.category).reduce((s, p) => s + p.h, 0);
          const y1 = sourceNode.y + sameBucketBefore;
          const y2 = categoryNode.y + sameCategoryBefore;
          const faded = dim(path.bucket, path.category);
          return (
            <path
              key={`${path.bucket}-${path.category}-${index}`}
              d={ribbon(LEFT_X + BAR_W, y1, Math.max(1, path.h - 1), RIGHT_X, y2, Math.max(1, path.h - 1))}
              fill={colorOf(path.category)}
              fillOpacity={faded ? 0.08 : 0.5}
              stroke="none"
              onMouseEnter={() => setHover({ kind: "link", key: path.bucket })}
              onMouseLeave={() => setHover(null)}
              style={{ transition: "fill-opacity 120ms ease" }}
            >
              <title>{translate("{0} → {1}：{2} 条", [path.bucket === "__rest__" ? "其他信源" : path.bucket, labelOf(path.category), path.count])}</title>
            </path>
          );
        })}

        {layout.sourceNodes.map((node) => {
          const rowY = leftRows.get(node.key) ?? node.y + node.h / 2;
          const anchored = Math.abs(rowY - (node.y + node.h / 2)) > 1.5;
          return (
            <g key={node.key} onMouseEnter={() => setHover({ kind: "source", key: node.key })} onMouseLeave={() => setHover(null)}>
              <rect x={LEFT_X} y={node.y} width={BAR_W} height={node.h} rx={2} fill={node.key === "__rest__" ? "var(--line-strong)" : "var(--ink-3)"} />
              {anchored && <line x1={LEFT_X - 4} y1={node.y + node.h / 2} x2={LEFT_X - 8} y2={rowY} stroke="var(--line-strong)" strokeWidth="0.8" />}
              <text x={LEFT_X - 10} y={rowY} textAnchor="end" dominantBaseline="middle" fontSize={11.5} fill="var(--ink-2)">
                {clamp(node.label)}
                <tspan dx="4" fontSize={10.5} fill="var(--ink-4)" className="num">{node.count}</tspan>
              </text>
            </g>
          );
        })}

        {layout.categoryNodes.map((node) => {
          const rowY = rightRows.get(node.key) ?? node.y + node.h / 2;
          const anchored = Math.abs(rowY - (node.y + node.h / 2)) > 1.5;
          return (
            <g key={node.key} onMouseEnter={() => setHover({ kind: "category", key: node.key })} onMouseLeave={() => setHover(null)}>
              <rect x={RIGHT_X} y={node.y} width={BAR_W} height={node.h} rx={2} fill={colorOf(node.key)} />
              {anchored && <line x1={RIGHT_X + BAR_W + 4} y1={node.y + node.h / 2} x2={RIGHT_X + BAR_W + 8} y2={rowY} stroke="var(--line-strong)" strokeWidth="0.8" />}
              <text x={RIGHT_X + BAR_W + 10} y={rowY} fontSize={11.5} fill="var(--ink-2)" dominantBaseline="middle">
                {ui(node.label)}
                <tspan dx="4" fontSize={10.5} fill="var(--ink-4)" className="num">{node.count}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
