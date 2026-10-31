// The backend of the site's modules, installed by the api and the worker when they start (site/modules/index.ts).
import type { ServerModule } from "@aihot/backend/modules";
import { vulnBriefServer } from "@aihot/vuln-brief/server";
import { vulnPocsServer } from "@aihot/vuln-pocs/server";
import { vulnSignalsServer } from "@aihot/vuln-signals/server";

export const SERVER_MODULES: readonly ServerModule[] = [vulnSignalsServer, vulnPocsServer, vulnBriefServer];
