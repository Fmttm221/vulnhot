// 文章页上的红队 / 蓝队视角。数据从模块自己的接口读（服务端渲染阶段先不出，水合后补上），
// 一段读过的条目在本次会话里不再重复请求。
import { useEffect, useState } from "react";
import type { SiteItemDetail } from "@aihot/contracts/site";

interface Perspective {
  red: string | null;
  blue: string | null;
  caveats: string[];
  updatedAt: string | null;
  /** 接口明确说"还没有"（历史存量，或刚发布还没来得及生成）。 */
  pending?: boolean;
}

const cache = new Map<string, Perspective>();

function Lines({ text }: { text: string }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {text
        .split("\n")
        .map((line) => line.replace(/^\s*[-*·]\s*/, "").trim())
        .filter(Boolean)
        .map((line, index) => (
          <li key={index} className="flex gap-2 text-[14.5px] leading-[1.75] text-ink-2">
            <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />
            <span>{line}</span>
          </li>
        ))}
    </ul>
  );
}

function Zone({ tone, kicker, title, text }: { tone: "red" | "blue"; kicker: string; title: string; text: string }) {
  const accent = tone === "red" ? "text-hot" : "text-ok";
  const border = tone === "red" ? "border-l-hot" : "border-l-ok";
  return (
    <section className={`rounded-card border border-line-soft border-l-2 ${border} bg-surface-2 px-4 py-3.5`}>
      <div className="flex items-baseline gap-2">
        <span className={`text-[12px] font-semibold tracking-[0.18em] ${accent}`}>{kicker}</span>
        <span className="text-[15px] font-bold text-ink">{title}</span>
      </div>
      <Lines text={text} />
    </section>
  );
}

export function PerspectiveBlock({ item }: { item: SiteItemDetail }) {
  const [data, setData] = useState<Perspective | null>(() => cache.get(item.id) ?? null);

  useEffect(() => {
    if (cache.has(item.id)) {
      setData(cache.get(item.id)!);
      return;
    }
    let alive = true;
    fetch(`/api/site/perspective/${encodeURIComponent(item.id)}`, { headers: { accept: "application/json" } })
      .then((res) => (res.ok ? (res.json() as Promise<Perspective>) : null))
      .then((json) => {
        if (!json) return;
        cache.set(item.id, json);
        if (alive) setData(json);
      })
      .catch(() => {
        /* 没有就没有，不打断阅读 */
      });
    return () => {
      alive = false;
    };
  }, [item.id]);

  if (!data?.red || !data.blue) {
    // 老存量：明确说明没生成，而不是让读者以为坏了
    if (data?.pending) {
      return (
        <div className="mt-7 rounded-card border border-line-soft bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-4">
          这条是站点首次导入时的存量资料，没有生成红队/蓝队视角；点上方「打开原文」可以看到来源的完整内容。
        </div>
      );
    }
    return null;
  }

  return (
    <div className="mt-7 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[12px] font-semibold text-ink-3">攻防两侧怎么看这一条</div>
        <div className="text-[11.5px] text-ink-4">模型依据本条材料生成，未经验证</div>
      </div>
      <Zone tone="red" kicker="RED" title="红队视角 · 怎么打" text={data.red} />
      <Zone tone="blue" kicker="BLUE" title="蓝队视角 · 怎么防" text={data.blue} />
      {data.caveats.length > 0 && (
        <ul className="space-y-1 pl-1 text-[12px] leading-[1.7] text-ink-4">
          {data.caveats.map((caveat) => (
            <li key={caveat}>· {caveat}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
