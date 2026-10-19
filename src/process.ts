import { loadConfig } from "./config";
import { planInbox } from "./planner";
import { runManifest } from "./job-runner";

const config = await loadConfig();

const { manifest } =
  await planInbox(config);

await runManifest(
  config,
  manifest,
  {
    archiveSourcesOnSuccess: true
  }
);
