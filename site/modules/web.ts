// What the site's modules add to the web pages (site/modules/index.ts).
import type { WebModule } from "@aihot/web/modules";
import { vulnBriefWeb } from "@aihot/vuln-brief/web";
import { vulnhotThemesWeb } from "@aihot/vulnhot-themes/web";
import { vulnSignalsWeb } from "@aihot/vuln-signals/web";

export const WEB_MODULES: readonly WebModule[] = [vulnhotThemesWeb, vulnSignalsWeb, vulnBriefWeb];
