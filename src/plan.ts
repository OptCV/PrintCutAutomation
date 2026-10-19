import { loadConfig } from "./config";
import { planInbox } from "./planner";

const config = await loadConfig();
await planInbox(config);
