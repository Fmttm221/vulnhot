import { t as translate, uiCopy } from "../lib/i18n";
import { POLICY as SOURCE_POLICY, SITE as SOURCE_SITE } from "@aihot/site";
import copy from "@aihot/site/pages/privacy.md?raw";
import { edgeTtl } from "../lib/api.server";
import { pageMeta } from "../lib/seo";
import { prepareCopy } from "../lib/site-copy";
import { CopyPage, LegalFooterLinks } from "../features/copy/CopyPage";
import type { Screen } from "../components/shell/screens";


export const handle: Screen = { tab: "me" };

const PRIVACY = prepareCopy(copy);

export function headers() {
  return edgeTtl(300);
}

export function meta() {
  const POLICY = uiCopy(SOURCE_POLICY);
  return pageMeta({ title: translate("隐私说明"), description: POLICY.privacy.description, path: "/privacy", image: "/og/pages/privacy.png" });
}

export default function PrivacyPage() {
  const POLICY = uiCopy(SOURCE_POLICY);
  const SITE = uiCopy(SOURCE_SITE);
  return (
    <CopyPage
      doc={PRIVACY.doc}
      rendered={PRIVACY.rendered}
      eyebrow={SITE.name}
      footer={<LegalFooterLinks links={[{ to: "/terms", label: POLICY.terms.name }, { to: "/feedback", label: translate("反馈页") }]} note={translate("隐私说明 {0} · {1}", [PRIVACY.doc.meta["版本"] ?? "", PRIVACY.doc.meta["生效日期"] ?? ""])} />}
    />
  );
}
