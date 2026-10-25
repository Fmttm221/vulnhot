import { t as translate, uiCopy } from "../lib/i18n";
import { POLICY as SOURCE_POLICY, SITE as SOURCE_SITE } from "@aihot/site";
import copy from "@aihot/site/pages/terms.md?raw";
import { edgeTtl } from "../lib/api.server";
import { pageMeta } from "../lib/seo";
import { prepareCopy } from "../lib/site-copy";
import { CopyPage, LegalFooterLinks } from "../features/copy/CopyPage";
import type { Screen } from "../components/shell/screens";
import { webModules } from "../site-modules";


export const handle: Screen = { tab: "me" };

const TERMS = prepareCopy(copy);

export function headers() {
  return edgeTtl(300);
}

export function meta() {
  const POLICY = uiCopy(SOURCE_POLICY);
  return pageMeta({ title: POLICY.terms.name, description: POLICY.terms.description, path: "/terms", image: "/og/pages/terms.png" });
}

export default function TermsPage() {
  const POLICY = uiCopy(SOURCE_POLICY);
  const SITE = uiCopy(SOURCE_SITE);
  return (
    <CopyPage
      doc={TERMS.doc}
      rendered={TERMS.rendered}
      eyebrow={SITE.name}
      footer={
        <LegalFooterLinks
          links={[
            { to: "/privacy", label: translate("隐私说明") },
            { to: "/agent", label: translate("Agent 接入页") },
            ...webModules().flatMap((m) => m.termsLinks ?? []),
          ]}
          note={`${POLICY.terms.name} ${TERMS.doc.meta["版本"] ?? ""} · ${TERMS.doc.meta["生效日期"] ?? ""}`}
        />
      }
    />
  );
}
