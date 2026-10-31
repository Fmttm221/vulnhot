import { installModules } from "@aihot/backend/modules";
import { SERVER_MODULES } from "@aihot/site/modules/server";
import { vulnPocsServer } from "@aihot/vuln-pocs/server";
installModules(SERVER_MODULES);
const schedule = vulnPocsServer.schedules?.[0];
if (!schedule) throw new Error("no schedule");
console.log(JSON.stringify(await schedule.run()));
