import { basename, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { buildManifest } from "./layout";
import { askQuantity, expandCopies } from "./quantities";
import { getPaths } from "./config";
import {
  exists,
  listInputFiles,
  writeJson
} from "./files";
import { parseDimensionsFromFilename } from "./filename-parser";
import {
  askNumber,
  askText,
  askYesNo
} from "./questions";
import type {
  AppConfig,
  JobManifest,
  SourceAsset
} from "./types";

function safeBatchId(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!cleaned) {
    throw new Error("Batch name cannot be empty.");
  }

  return cleaned;
}

function defaultBatchId() {
  const d = new Date();
  const pad = (n: number) =>
    String(n).padStart(2, "0");

  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    "-",
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds())
  ].join("");
}

export async function planInbox(config: AppConfig): Promise<{
  manifest: JobManifest;
  manifestPath: string;
  inputFiles: string[];
}> {
  const paths = getPaths(config);
  const inputFiles = await listInputFiles(paths);

  if (inputFiles.length === 0) {
    throw new Error(
      `No supported artwork files found in:\n${paths.inbox}`
    );
  }

  console.log("");
  console.log(`Found ${inputFiles.length} artwork file(s):`);
  for (const file of inputFiles) {
    console.log(`  - ${basename(file)}`);
  }

  const batchId = safeBatchId(
    askText("Batch name", defaultBatchId())
  );

  const manifestPath = resolve(
    paths.jobs,
    batchId,
    "manifest.json"
  );

  if (await exists(manifestPath)) {
    throw new Error(
      `A manifest already exists for batch "${batchId}":\n${manifestPath}\n` +
      `Choose another batch name or remove the old job intentionally.`
    );
  }

  const maxPdfWidthIn = askNumber(
    "Maximum FINAL PDF width in inches",
    config.defaults.maxPdfWidthIn,
    { minExclusive: 0 }
  );

  const maxPdfLengthIn = askNumber(
    "Maximum FINAL PDF length before splitting in inches",
    undefined,
    { minExclusive: 0 }
  );

  const bleedIn = askNumber(
    "Bleed to add OUTSIDE finished size in inches",
    config.defaults.bleedIn,
    { minInclusive: 0 }
  );

  const allowRotation = askYesNo(
    "Allow 90-degree rotation while nesting",
    config.defaults.allowRotation
  );

  const assets: SourceAsset[] = [];
  const skippedSourcePaths: string[] = [];

  for (let i = 0; i < inputFiles.length; i++) {
    const sourcePath = inputFiles[i];
    const fileName = basename(sourcePath);
    const parsed = parseDimensionsFromFilename(
      sourcePath
    );

    let finishedWidthIn: number;
    let finishedHeightIn: number;

    console.log("");
    console.log(
      `[${i + 1}/${inputFiles.length}] ${fileName}`
    );

    if (parsed) {
      finishedWidthIn = parsed.widthIn;
      finishedHeightIn = parsed.heightIn;

      console.log(
        `  Detected final size: ` +
        `${finishedWidthIn} x ${finishedHeightIn} in`
      );

      if (
        !askYesNo(
          "  Use this as the FINAL cut size",
          true
        )
      ) {
        finishedWidthIn = askNumber(
          "  Final width in inches",
          finishedWidthIn,
          { minExclusive: 0 }
        );

        finishedHeightIn = askNumber(
          "  Final height in inches",
          finishedHeightIn,
          { minExclusive: 0 }
        );
      }
    } else {
      console.log(
        "  No supported dimensions detected in filename."
      );

      finishedWidthIn = askNumber(
        "  Final width in inches",
        undefined,
        { minExclusive: 0 }
      );

      finishedHeightIn = askNumber(
        "  Final height in inches",
        undefined,
        { minExclusive: 0 }
      );
    }

    const quantity = askQuantity(fileName);

    if (quantity === 0) skippedSourcePaths.push(sourcePath);

    assets.push(...expandCopies({
      id: `item-${String(i + 1).padStart(3, "0")}`,
      fileName,
      sourcePath,
      sourcePage: 1,
      finishedWidthIn,
      finishedHeightIn
    }, quantity));
  }

  if (assets.length === 0) {
    throw new Error("All quantities are zero. No artwork was selected for this batch.");
  }

  console.log(`\nTotal pieces to nest: ${assets.length}`);

  const manifest = buildManifest({
    batchId,
    assets,
    maxPdfWidthIn,
    maxPdfLengthIn,
    bleedIn,
    itemGapIn: config.defaults.itemGapIn,
    allowRotation,
    config,
    paths
  });

  manifest.input.skippedSourcePaths = skippedSourcePaths;

  await mkdir(
    resolve(paths.jobs, batchId),
    { recursive: true }
  );

  await writeJson(
    manifestPath,
    manifest
  );

  console.log("");
  console.log("PLAN COMPLETE");
  console.log(`Manifest: ${manifestPath}`);
  console.log(
    `Panel pairs: ${manifest.pages.length}`
  );

  for (const page of manifest.pages) {
    console.log(
      `  P${String(page.page).padStart(2, "0")}: ` +
      `${page.documentWidthIn}" x ${page.documentHeightIn}" | ` +
      `${page.items.length} item(s)`
    );
  }

  return {
    manifest,
    manifestPath,
    inputFiles
  };
}
