import { t as translate } from "@aihot/web/lib/i18n";
// 文章页上的精读：一段读得懂的短文（段落之间空行，重点用 ==…== 标出来，渲染成站点主题的强调色），
// 后面跟可执行的自查与处置。数据来自模块接口（页面打开时不联网到外部）；没有精读的条目不占版面。
import { useEffect, useState } from "react";
import type { SiteItemDetail } from "@aihot/contracts/site";

interface Brief {
  body: string;
  check: string[];
  action: string[];
  caveats: string[];
  updatedAt: string | null;
}

const cache = new Map<string, Brief | null>();
const CVE_RE = /CVE-\d{4}-\d{4,7}/i;
/** 模型用 ==…== 标出来的重点。 */
const MARK = /==([^=\n]{1,120})==/g;

/** 一段文字里的重点渲染成主题色；其余原样输出。 */
function Prose({ text }: { text: string }) {
  const parts: Array<{ text: string; mark: boolean }> = [];
  let last = 0;
  for (const match of text.matchAll(MARK)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at), mark: false });
    parts.push({ text: match[1]!, mark: true });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mark: false });
  return (
    <>
      {parts.map((part, index) =>
        part.mark ? (
          <mark key={index} className="rounded-[3px] bg-hot-soft px-[3px] font-semibold text-hot">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

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

  const paragraphs = brief.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  return (
    <div className="mt-7 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[12px] font-semibold text-ink-3">{translate("精读")}</div>
        <div className="text-[11.5px] text-ink-4">{translate("模型依据本条材料生成，未经验证")}</div>
      </div>

      <div className="rounded-card border border-line-soft border-l-2 border-l-accent bg-surface px-4 py-4">
        <div className="space-y-3">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className={`text-[14.5px] leading-[1.85] ${index === 0 ? "text-ink" : "text-ink-2"}`}>
              <Prose text={paragraph} />
            </p>
          ))}
        </div>

        {brief.check.length > 0 && (
          <div className="mt-4 border-t border-line-soft pt-3">
            <div className="text-[14px] font-bold text-ink">{translate("我是否受影响")}</div>
            <ol className="mt-1.5 space-y-1.5">
              {brief.check.map((step, index) => (
                <li key={index} className="flex gap-2 text-[14px] leading-[1.75] text-ink-2">
                  <span className="mono mt-[2px] shrink-0 text-[12px] font-semibold text-ink-4">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {brief.action.length > 0 && (
          <div className="mt-3.5">
            <div className="text-[14px] font-bold text-ink">{translate("现在该做什么")}</div>
            <ul className="mt-1.5 space-y-1.5">
              {brief.action.map((step, index) => (
                <li key={index} className="flex gap-2 text-[14px] leading-[1.75] text-ink-2">
                  <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ok" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
