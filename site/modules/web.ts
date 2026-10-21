// What the site's modules add to the web pages (site/modules/index.ts).
import type { WebModule } from "@aihot/web/modules";
import { vulnhotThemesWeb } from "@aihot/vulnhot-themes/web";
import { vulnPerspectiveWeb } from "@aihot/vuln-perspective/web";
import { vulnSignalsWeb } from "@aihot/vuln-signals/web";

export const WEB_MODULES: readonly WebModule[] = [vulnhotThemesWeb, vulnSignalsWeb, vulnPerspectiveWeb];
