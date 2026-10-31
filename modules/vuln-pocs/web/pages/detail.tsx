import { t as translate } from "@aihot/web/lib/i18n";
// /poc/:cve：一个 CVE 的公开利用清单——仓库地址、检测模板、模块、靶场，按分类列出。
import { Link, useLoaderData } from "react-router";
import { cachedPage, loadOr404, pageHeaders } from "@aihot/web/lib/api.server";
import { pageMeta } from "@aihot/web/lib/seo";
import { ArrowBack } from "./back.tsx";
import type { Screen } from "@aihot/web/components/shell/screens";

type Kind = "poc" | "nuclei" | "msf" | "edb" | "vulhub" | "collections";

interface Artifact {
  kind: Kind;
  url: string;
  name: string;
  stars: number | null;
  lastPush: string | null;
}

interface Poc {
  cve: string;
  description: string | null;
  published: string | null;
  counts: Record<Kind, number>;
  signals: { cvss: number | null; epss: number | null; inKev: boolean } | null;
  artifacts: Artifact[];
}

export const handle: Screen = { tab: "me", name: "CVE" };
export { pageHeaders as headers } from "@aihot/web/lib/api.server";

export async function loader({ params, request }: { params: { cve?: string }; request: Request }) {
  const cve = (params.cve ?? "").toUpperCase();
  const data = await loadOr404<{ poc: Poc | null }>(`/api/site/pocs/${encodeURIComponent(cve)}`, { signal: request.signal });
  if (!data.poc) throw new Response("not found", { status: 404 });
  return cachedPage(600, { poc: data.poc });
}

export function meta({ loaderData }: { loaderData?: { poc: Poc } }) {
  if (!loaderData?.poc) return pageMeta({ title: translate("PoC 索引"), path: "/poc", noindex: true });
  const { poc } = loaderData;
  return pageMeta({
    title: `${poc.cve} 的公开利用`,
    description: poc.description?.slice(0, 150) ?? translate("这条 CVE 的公开利用代码与检测模板。"),
    path: `/poc/${poc.cve}`,
  });
}

const ORDER: Kind[] = ["poc", "nuclei", "msf", "edb", "vulhub", "collections"];

export default function PocDetail() {
  const { poc } = useLoaderData<typeof loader>();
  const labels: Record<Kind, string> = {
    poc: translate("PoC 仓库"),
    nuclei: translate("Nuclei 模板"),
    msf: translate("Metasploit 模块"),
    edb: translate("ExploitDB 条目"),
    vulhub: translate("Vulhub 环境"),
    collections: translate("集合仓库"),
  };
  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] pb-12">
      <div className="pt-3"><ArrowBack /></div>
      <header className="mt-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="mono text-[24px] font-bold leading-snug text-ink">{poc.cve}</h1>
          {poc.signals?.cvss != null && <span className="text-[12.5px] text-ink-3">CVSS <span className="num font-semibold text-ink">{poc.signals.cvss}</span></span>}
          {poc.signals?.inKev && <span className="chip text-hot">{translate("在 CISA KEV 里")}</span>}
          {poc.published && <span className="text-[12px] text-ink-4">{translate("披露于 {0}", [poc.published])}</span>}
        </div>
        {poc.description && <p className="mt-2.5 text-[14px] leading-[1.8] text-ink-2">{poc.description}</p>}
      </header>

      <div className="mt-6 space-y-6">
        {ORDER.filter((kind) => poc.counts[kind] > 0).map((kind) => (
          <section key={kind}>
            <h2 className="mb-2 flex items-baseline gap-2 text-[14px] font-semibold text-ink">
              {labels[kind]}
              <span className="num text-[12px] font-normal text-ink-4">{poc.counts[kind]}</span>
            </h2>
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {poc.artifacts.filter((a) => a.kind === kind).map((artifact) => (
                <li key={artifact.url} className="flex items-baseline gap-2 py-2">
                  <a href={artifact.url} target="_blank" rel="noopener noreferrer" className="mono min-w-0 flex-1 truncate text-[13px] text-ink-2 transition-colors hover:text-accent">
                    {artifact.name}
                  </a>
                  {artifact.stars !== null && artifact.stars > 0 && <span className="shrink-0 text-[11.5px] text-ink-4">{artifact.stars}★</span>}
                  {artifact.lastPush && <span className="shrink-0 text-[11.5px] text-ink-4">{artifact.lastPush}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-[12px] leading-relaxed text-ink-4">
        {translate("数据来自 pocindex 的公开索引，按天更新；本站只做同步，不验证这些代码能否运行。")}{" "}
        <Link to="/poc" className="text-ink-3 transition-colors hover:text-accent">{translate("查别的编号")}</Link>
      </p>
    </div>
  );
}
