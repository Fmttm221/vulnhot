import { t as translate } from "@aihot/web/lib/i18n";
// /poc：PoC 索引的搜索页。数据是模块自己同步进库的 pocindex 公开索引（83k 个有公开利用的 CVE）。
import { Link, useLoaderData } from "react-router";
import { apiGet, cachedPage, pageHeaders } from "@aihot/web/lib/api.server";
import { pageMeta, siteUrl } from "@aihot/web/lib/seo";
import { PhoneBar } from "@aihot/web/components/shell/PhoneBar";
import type { Screen } from "@aihot/web/components/shell/screens";

export const handle: Screen = { tab: "me", name: "PoC 索引" };
export { pageHeaders as headers } from "@aihot/web/lib/api.server";

export interface SearchHit {
  cve: string;
  description: string | null;
  poc: number;
  nuclei: number;
}

export async function loader({ request }: { request: Request }) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const items = q
    ? (await apiGet<{ items: SearchHit[] }>(`/api/site/pocs/search?q=${encodeURIComponent(q)}`, { signal: request.signal })).items
    : [];
  return cachedPage(120, { q, items });
}

export function meta() {
  return pageMeta({
    title: translate("PoC 索引"),
    description: translate("按 CVE 编号或产品名查公开的漏洞利用代码：GitHub 仓库、Nuclei 模板、Metasploit 模块、ExploitDB 条目、Vulhub 环境。"),
    path: "/poc",
  });
}

export default function PocIndex() {
  const { q, items } = useLoaderData<typeof loader>();
  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] pb-12">
      <PhoneBar title={translate("PoC 索引")} />
      <header className="pt-3">
        <h1 className="text-[24px] font-bold leading-snug text-ink">{translate("PoC 索引")}</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">
          {translate("查一个 CVE 有没有公开的利用代码：仓库、检测模板、模块、靶场。数据来自 pocindex 的公开索引，每 6 小时同步一次。")}
        </p>
      </header>

      <form action="/poc" method="get" className="mt-5 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={translate("搜 CVE 编号、产品或厂商，如 CVE-2021-44228")}
          aria-label={translate("搜 CVE 编号、产品或厂商")}
          className="h-11 min-w-0 flex-1 rounded-control border border-line bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-accent focus:outline-none"
        />
        <button type="submit" className="h-11 shrink-0 rounded-control border border-line bg-surface px-4 text-[14px] font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent">
          {translate("搜索")}
        </button>
      </form>

      {q && items.length === 0 && (
        <p className="mt-8 text-[14px] leading-relaxed text-ink-3">{translate("没有找到与「{0}」匹配的编号或描述。", [q])}</p>
      )}

      {items.length > 0 && (
        <ul className="mt-5 divide-y divide-line-soft border-t border-line-soft">
          {items.map((hit) => (
            <li key={hit.cve}>
              <Link viewTransition to={`/poc/${hit.cve}`} className="group block py-3">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="mono text-[14px] font-semibold text-ink transition-colors group-hover:text-accent">{hit.cve}</span>
                  <span className="text-[11.5px] text-ink-4">
                    {translate("PoC 仓库")} {hit.poc} · {translate("Nuclei 模板")} {hit.nuclei}
                  </span>
                </div>
                {hit.description && <p className="mt-1 line-clamp-2 text-[13px] leading-[1.7] text-ink-3">{hit.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!q && (
        <p className="mt-6 text-[12.5px] leading-relaxed text-ink-4">
          {translate("索引里只有「有公开利用」的编号；页面按公开利用条目多少排序。")}
          {" "}
          <span className="mono">{siteUrl()}/poc/CVE-2021-44228</span>
        </p>
      )}
    </div>
  );
}
