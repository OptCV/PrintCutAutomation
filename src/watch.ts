import { getPaths, loadConfig } from "./config";
import {
  fileSignature,
  listInputFiles
} from "./files";
import { planInbox } from "./planner";
import { runManifest } from "./job-runner";

const config = await loadConfig();
const paths = getPaths(config);

let lastSignature = "";
let stableSince = 0;
let processing = false;

console.log(`Watching: ${paths.inbox}`);
console.log(
  `A batch begins after files remain unchanged for ` +
  `${config.dropSettleMs} ms.`
);
console.log(
  "You will still be asked for batch width, length, bleed, rotation, " +
  "and missing/overridden dimensions."
);
console.log("");

for (;;) {
  if (!processing) {
    const files = await listInputFiles(paths);

    if (files.length === 0) {
      lastSignature = "";
      stableSince = 0;
    } else {
      const signature =
        await fileSignature(files);

      if (signature !== lastSignature) {
        lastSignature = signature;
        stableSince = Date.now();
      } else if (
        stableSince > 0 &&
        Date.now() - stableSince >= config.dropSettleMs
      ) {
        processing = true;

        try {
          const { manifest } =
            await planInbox(config);

          await runManifest(
            config,
            manifest,
            {
              archiveSourcesOnSuccess: true
            }
          );
        } catch (error) {
          console.error("");
          console.error(
            error instanceof Error
              ? error.message
              : String(error)
          );
          console.error(
            "The source artwork remains in the inbox after a failed job."
          );
        } finally {
          processing = false;
          lastSignature = "";
          stableSince = 0;
        }
      }
    }
  }

  await Bun.sleep(1000);
}
