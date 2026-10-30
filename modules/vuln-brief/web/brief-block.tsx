import { t as translate, ui } from "@aihot/web/lib/i18n";
// 文章页上的精读：先认名字（标题里出现、门外汉不认识的产品/机构/工具，一句话说清），
// 再给三句背景（谁、能干什么、为什么现在要管），最后是六段精读。
// 数据来自模块接口（页面打开时不联网到外部）；没有生成精读的条目什么都不显示，不占版面。
import { useEffect, useState } from "react";
import type { SiteItemDetail } from "@aihot/contracts/site";

interface Term {
  term: string;
  plain: string;
}

interface Brief {
  who: string;
  what: string;
  why: string;
  story: string;
  usage: string;
  impact: string;
  check: string[];
  action: string[];
  terms: Term[];
  caveats: string[];
  updatedAt: string | null;
}

const cache = new Map<string, Brief | null>();
const CVE_RE = /CVE-\d{4}-\d{4,7}/i;

const SECTIONS: Array<{ key: "story" | "usage" | "impact"; label: string; hint: string }> = [
  { key: "story", label: "发生了什么", hint: "" },
  { key: "usage", label: "这东西是什么", hint: "谁在用它、装在哪" },
  { key: "impact", label: "攻击者能干什么", hint: "" },
];

export function BriefBlock({ item }: { item: SiteItemDetail }) {
  const text = `${item.title} ${item.summary ?? ""}`;
  // 只有精选里的漏洞才写精读：别的条目不查，避免每条都发一次请求。
  const eligible = item.selected && CVE_RE.test(text);
  const [brief, setBrief] = useState<Brief | null>(() => cache.get(item.id) ?? null);

  useEffect(() => {
    if (!eligible) return;
    const hit = cache.get(item.id);
    if (hit !== undefined) {
      setBrief(hit);
      return;
    }
    let alive = true;
    fetch(`/api/site/brief/${encodeURIComponent(item.id)}`, { headers: { accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { brief?: Brief | null } | null) => {
        const value = json?.brief ?? null;
        cache.set(item.id, value);
        if (alive) setBrief(value);
      })
      .catch(() => {
        /* 没有就没有，不打断阅读 */
      });
    return () => {
      alive = false;
    };
  }, [eligible, item.id]);

  if (!eligible || !brief) return null;

  return (
    <div className="mt-7 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[12px] font-semibold text-ink-3">{translate("精读")}</div>
        <div className="text-[11.5px] text-ink-4">{translate("模型依据本条材料生成，未经验证")}</div>
      </div>

      {brief.terms.length > 0 && (
        <div className="rounded-card border border-line-soft bg-surface-2 px-4 py-3.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[12px] font-semibold tracking-[0.18em] text-accent">{ui("先认名字")}</span>
            <span className="text-[11.5px] text-ink-4">{ui("标题里出现、你可能不认识的名字，一句话说清")}</span>
          </div>
          <dl className="mt-2 space-y-1.5">
            {brief.terms.map((term) => (
              <div key={term.term} className="flex flex-col gap-0.5 text-[13.5px] leading-[1.7] sm:flex-row sm:gap-2">
                <dt className="mono shrink-0 font-semibold text-ink">{term.term}</dt>
                <dd className="text-ink-2">{term.plain}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <dl className="space-y-2 rounded-card border border-line-soft bg-surface-2 px-4 py-3.5">
        {(
          [
            [translate("谁做的"), brief.who],
            [translate("能干什么"), brief.what],
            [translate("为什么现在管"), brief.why],
          ] as Array<[string, string]>
        ).map(([label, value]) => (
          <div key={ui(label)} className="flex gap-3">
            <dt className="mt-[3px] w-[76px] shrink-0 text-[12px] font-semibold text-ink-4">{ui(label)}</dt>
            <dd className="text-[14.5px] leading-[1.75] text-ink-2">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="rounded-card border border-line-soft border-l-2 border-l-accent bg-surface px-4 py-3.5">
        <div className="mt-0.5 space-y-3.5">
          {SECTIONS.map((section) => (
            <div key={section.key}>
              <div className="flex items-baseline gap-2">
                <span className="text-[14px] font-bold text-ink">{ui(section.label)}</span>
                {section.hint && <span className="text-[11.5px] text-ink-4">{ui(section.hint)}</span>}
              </div>
              <p className="mt-1 text-[14.5px] leading-[1.75] text-ink-2">{brief[section.key]}</p>
            </div>
          ))}

          {brief.check.length > 0 && (
            <div>
              <div className="text-[14px] font-bold text-ink">{translate("我是否受影响")}</div>
              <ol className="mt-1.5 space-y-1.5">
                {brief.check.map((step, index) => (
                  <li key={index} className="flex gap-2 text-[14.5px] leading-[1.75] text-ink-2">
                    <span className="mono mt-[2px] shrink-0 text-[12px] font-semibold text-ink-4">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {brief.action.length > 0 && (
            <div>
              <div className="text-[14px] font-bold text-ink">{translate("现在该做什么")}</div>
              <ul className="mt-1.5 space-y-1.5">
                {brief.action.map((step, index) => (
                  <li key={index} className="flex gap-2 text-[14.5px] leading-[1.75] text-ink-2">
                    <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ok" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {brief.caveats.length > 0 && (
        <ul className="space-y-1 pl-1 text-[12px] leading-[1.7] text-ink-4">
          {brief.caveats.map((caveat) => (
            <li key={caveat}>· {caveat}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
