import { basename, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { getPaths } from "./config";
import {
  archiveSources,
  exists,
  verifyNonEmptyFiles,
  writeJson
} from "./files";
import type {
  AppConfig,
  JobManifest
} from "./types";
import { connectOrLaunchVectorCraft } from "./vectorcraft/runtime";
import { validateManifest } from "./validate-manifest";
import { renderManifest } from "./vectorcraft/render";

export async function runManifest(
  config: AppConfig,
  manifest: JobManifest,
  options: {
    archiveSourcesOnSuccess?: boolean;
  } = {}
) {
  const paths = getPaths(config);

  validateManifest(manifest);

  const sourceFiles = [
    ...new Set([
      ...manifest.pages.flatMap((page) =>
        page.items.map((item) => item.sourcePath)
      ),
      ...(manifest.input.skippedSourcePaths ?? [])
    ])
  ];

  for (const source of sourceFiles) {
    if (!(await exists(source))) {
      throw new Error(
        `Source file required by the manifest is missing:\n${source}`
      );
    }
  }

  const outputFiles = manifest.pages.flatMap(
    (page) => [
      page.printPdf,
      page.cutPdf
    ]
  );

  const alreadyExists: string[] = [];

  for (const file of outputFiles) {
    if (await exists(file)) alreadyExists.push(file);
  }

  if (alreadyExists.length) {
    throw new Error(
      "Refusing to overwrite existing production output:\n" +
      alreadyExists.map((file) => `  - ${file}`).join("\n") +
      "\nRemove those files intentionally before rendering again."
    );
  }

  await mkdir(
    resolve(paths.output, manifest.batchId),
    { recursive: true }
  );

  const { client, launched } =
    await connectOrLaunchVectorCraft(config);

  console.log(
    launched
      ? "Started VectorCraft control session."
      : "Connected to existing VectorCraft control session."
  );

  const startedAt = new Date().toISOString();

  try {
    await renderManifest(
      client,
      manifest,
      config
    );

    await verifyNonEmptyFiles(outputFiles);

    const resultPath = resolve(
      paths.jobs,
      manifest.batchId,
      "result.json"
    );

    const result = {
      batchId: manifest.batchId,
      status: "success",
      startedAt,
      completedAt: new Date().toISOString(),
      outputs: outputFiles
    };

    await writeJson(
      resultPath,
      result
    );

    let archiveDir: string | null = null;

    if (options.archiveSourcesOnSuccess !== false) {
      archiveDir = await archiveSources(
        sourceFiles,
        paths,
        manifest.batchId
      );
    }

    console.log("");
    console.log("RENDER COMPLETE");
    console.log(
      `Output: ${resolve(paths.output, manifest.batchId)}`
    );

    if (archiveDir) {
      console.log(
        `Sources archived: ${archiveDir}`
      );
    }

    return {
      ...result,
      resultPath,
      archiveDir
    };
  } finally {
    client.close();
  }
}

export function summarizeManifest(manifest: JobManifest) {
  console.log("");
  console.log(`Batch: ${manifest.batchId}`);
  console.log(
    `Limits: ${manifest.input.maxPdfWidthIn}" W x ` +
    `${manifest.input.maxPdfLengthIn}" L`
  );
  console.log(
    `Bleed: ${manifest.input.bleedIn}" | ` +
    `Rotation: ${manifest.input.allowRotation ? "yes" : "no"}`
  );

  for (const page of manifest.pages) {
    console.log(
      `  P${String(page.page).padStart(2, "0")} ` +
      `${page.documentWidthIn}" x ${page.documentHeightIn}" | ` +
      `${page.items.map((item) => basename(item.fileName)).join(", ")}`
    );
  }
}
