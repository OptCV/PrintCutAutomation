import { resolve } from "node:path";
import { getPaths, loadConfig } from "./config";
import { readJson } from "./files";
import { runManifest, summarizeManifest } from "./job-runner";
import type { JobManifest } from "./types";

const batchId = process.argv[2];

if (!batchId) {
  console.error(
    "Usage: bun run render <batch-id>\n" +
    "Example: bun run render Test1"
  );
  process.exit(1);
}

const config = await loadConfig();
const paths = getPaths(config);

const manifestPath = resolve(
  paths.jobs,
  batchId,
  "manifest.json"
);

const manifest =
  await readJson<JobManifest>(manifestPath);

summarizeManifest(manifest);

await runManifest(
  config,
  manifest,
  {
    archiveSourcesOnSuccess: true
  }
);
