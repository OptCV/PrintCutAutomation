import { extname } from "node:path";
import { mkdir, stat } from "node:fs/promises";
import { POINTS_PER_INCH } from "../config";
import type {
  AppConfig,
  Bounds,
  JobManifest,
  LayoutItem,
  LayoutPage
} from "../types";
import { VectorCraftClient } from "./client";
import {
  assertExactlyLayers,
  deletePrintLayerBeforeCut,
  deleteStarterLayer,
  getStarterLayerId
} from "./layers";
import {
  commandId,
  normalizeCommandList,
  REQUIRED_COMMANDS
} from "./commands";

type PlaceInfo = {
  width?: number;
  height?: number;
  [key: string]: unknown;
};

type PlaceResult = {
  ids?: Array<number | string>;
  id?: number | string;
  [key: string]: unknown;
};

type IdResult = {
  id?: number | string;
  [key: string]: unknown;
};

const PT = POINTS_PER_INCH;

function toPt(inches: number) {
  return inches * PT;
}

function boundsToPt(bounds: Bounds) {
  return {
    x: toPt(bounds.x),
    y: toPt(bounds.y),
    width: toPt(bounds.width),
    height: toPt(bounds.height)
  };
}

function firstId(result: PlaceResult | IdResult) {
  if (Array.isArray((result as PlaceResult).ids)) {
    const ids = (result as PlaceResult).ids!;
    if (ids.length > 0) return ids[0];
  }

  if (result.id !== undefined) return result.id;

  throw new Error(
    `VectorCraft command did not return an object id: ${JSON.stringify(result)}`
  );
}

async function setNoPaint(
  client: VectorCraftClient,
  id: number | string
) {
  await client.execute("paint.setFill", {
    id,
    none: true
  });

  await client.execute("paint.setStroke", {
    id,
    none: true
  });
}

async function waitForNonEmptyFile(
  path: string,
  timeoutMs = 30000
) {
  const deadline = Date.now() + timeoutMs;
  let lastSize = -1;
  let stablePolls = 0;

  while (Date.now() < deadline) {
    try {
      const info = await stat(path);

      if (info.isFile() && info.size > 0) {
        if (info.size === lastSize) {
          stablePolls++;
        } else {
          stablePolls = 0;
          lastSize = info.size;
        }

        // Require the non-empty file size to remain unchanged for about
        // one second so a background export is not mistaken for completion.
        if (stablePolls >= 4) return;
      }
    } catch {
      lastSize = -1;
      stablePolls = 0;
    }

    await Bun.sleep(250);
  }

  throw new Error(
    `Timed out waiting for VectorCraft to finish writing:\n${path}`
  );
}

function computeCoverPlacement(args: {
  sourceWidthPt: number;
  sourceHeightPt: number;
  target: Bounds;
  rotated: boolean;
}) {
  const target = boundsToPt(args.target);

  const effectiveSourceWidth = args.rotated
    ? args.sourceHeightPt
    : args.sourceWidthPt;

  const effectiveSourceHeight = args.rotated
    ? args.sourceWidthPt
    : args.sourceHeightPt;

  const sourceAspect =
    effectiveSourceWidth / effectiveSourceHeight;

  const targetAspect =
    target.width / target.height;

  let coverWidth: number;
  let coverHeight: number;

  if (sourceAspect >= targetAspect) {
    coverHeight = target.height;
    coverWidth = coverHeight * sourceAspect;
  } else {
    coverWidth = target.width;
    coverHeight = coverWidth / sourceAspect;
  }

  const centerX = target.x + target.width / 2;
  const centerY = target.y + target.height / 2;

  // file.place receives the unrotated placement rectangle.
  const preRotateWidth = args.rotated
    ? coverHeight
    : coverWidth;

  const preRotateHeight = args.rotated
    ? coverWidth
    : coverHeight;

  return {
    rect: [
      centerX - preRotateWidth / 2,
      centerY - preRotateHeight / 2,
      preRotateWidth,
      preRotateHeight
    ],
    center: [centerX, centerY]
  };
}

async function placeArtwork(
  client: VectorCraftClient,
  item: LayoutItem
) {
  const extension = extname(item.sourcePath).toLowerCase();

  const infoParams: Record<string, unknown> = {
    path: item.sourcePath
  };

  if (extension === ".pdf" || extension === ".ai") {
    infoParams.page = item.sourcePage;
    infoParams.crop = "crop";
  }

  const info = await client.execute<PlaceInfo>(
    "file.place.info",
    infoParams
  );

  const sourceWidthPt = Number(info.width);
  const sourceHeightPt = Number(info.height);

  if (
    !Number.isFinite(sourceWidthPt) ||
    !Number.isFinite(sourceHeightPt) ||
    sourceWidthPt <= 0 ||
    sourceHeightPt <= 0
  ) {
    throw new Error(
      `VectorCraft did not report valid source dimensions for ${item.fileName}.\n` +
      `file.place.info returned: ${JSON.stringify(info)}`
    );
  }

  const placement = computeCoverPlacement({
    sourceWidthPt,
    sourceHeightPt,
    target: item.artworkBoundsIn,
    rotated: item.rotated
  });

  const placeParams: Record<string, unknown> = {
    path: item.sourcePath,
    link: false,
    rect: placement.rect
  };

  if (extension === ".pdf" || extension === ".ai") {
    placeParams.page = item.sourcePage;
    placeParams.crop = "crop";
  }

  const placed = await client.execute<PlaceResult>(
    "file.place",
    placeParams
  );

  const placedId = firstId(placed);

  if (item.rotated) {
    await client.execute("object.rotate", {
      ids: [placedId],
      angle: 90,
      origin: placement.center
    });
  }

  // Clip the placed artwork to the exact bleed box. This gives deterministic
  // bleed geometry while preserving source aspect ratio.
  const target = boundsToPt(item.artworkBoundsIn);

  const clip = await client.execute<IdResult>(
    "shape.rectangle",
    target
  );

  const clipId = firstId(clip);
  await setNoPaint(client, clipId);

  await client.execute("select.set", {
    ids: [placedId, clipId]
  });

  await client.execute(
    "object.clippingMask.make",
    {}
  );
}

async function drawCutPath(
  client: VectorCraftClient,
  item: LayoutItem,
  config: AppConfig
) {
  const bounds = boundsToPt(item.cutBoundsIn);

  const result = await client.execute<IdResult>(
    "shape.rectangle",
    bounds
  );

  const id = firstId(result);

  await client.execute("paint.setFill", {
    id,
    none: true
  });

  await client.execute("paint.setStroke", {
    id,
    color: config.cutLine.cmyk
  });

  await client.execute("stroke.set", {
    id,
    weight: config.cutLine.strokeWidthPt
  });
}

async function drawRegistrationMarks(
  client: VectorCraftClient,
  page: LayoutPage
) {
  for (const mark of page.registrationMarks) {
    const result = await client.execute<IdResult>(
      "shape.ellipse",
      {
        x: toPt(mark.x),
        y: toPt(mark.y),
        width: toPt(mark.diameterIn),
        height: toPt(mark.diameterIn)
      }
    );

    const id = firstId(result);

    await client.execute("paint.setFill", {
      id,
      color: {
        c: 0,
        m: 0,
        y: 0,
        k: 100
      }
    });

    await client.execute("paint.setStroke", {
      id,
      none: true
    });
  }
}

async function setLayerVisibility(
  client: VectorCraftClient,
  ids: {
    artwork: number | string;
    cut: number | string;
    reg: number | string;
  },
  mode: "print" | "cut"
) {
  await client.execute("layer.setProps", {
    id: ids.artwork,
    visible: mode === "print"
  });

  await client.execute("layer.setProps", {
    id: ids.cut,
    visible: mode === "cut"
  });

  await client.execute("layer.setProps", {
    id: ids.reg,
    visible: true
  });
}

async function exportPdf(
  client: VectorCraftClient,
  path: string,
  config: AppConfig
) {
  await mkdir(
    path.replace(/[\\/][^\\/]+$/, ""),
    { recursive: true }
  );

  // Allow layer-preserving PDF export on builds supporting PDF Optional
  // Content Groups (OCG). Disabling this yields a production-oriented flat PDF.
  // A hidden CUT layer may exist in the PRINT PDF; the PRINT layer is physically
  // deleted before CUT export so no hidden artwork layer can be preserved there.
  await client.request("app.export", {
    path,
    format: "pdf",
    useArtboards: true,
    preserveEditing: config.pdf?.preserveEditing ?? false,
    createLayers: config.pdf?.createLayers ?? true
  });

  await waitForNonEmptyFile(path);
}

async function closeWithoutSaving(
  client: VectorCraftClient
) {
  const result = await client.execute<unknown>(
    "file.close",
    {}
  );

  if (
    result &&
    typeof result === "object" &&
    "pending" in result &&
    (result as { pending?: unknown }).pending === "saveChanges"
  ) {
    await client.request("ui.dialog.set", {
      field: "discard",
      value: true
    });

    await client.request("ui.dialog.confirm", {});
  }
}

async function createLayer(
  client: VectorCraftClient,
  name: string
) {
  const result = await client.execute<IdResult>(
    "layer.new",
    {
      name,
      top: true
    }
  );

  return firstId(result);
}

export async function verifyVectorCraftSurface(
  client: VectorCraftClient
) {
  const raw = await client.commands();
  const commands = normalizeCommandList(raw);
  const available = new Set(commands.map(commandId));

  const missing = REQUIRED_COMMANDS.filter(
    (id) => !available.has(id)
  );

  if (missing.length) {
    throw new Error(
      "This VectorCraft build is missing required commands:\n" +
      missing.map((id) => `  - ${id}`).join("\n")
    );
  }

  return commands;
}

export async function renderManifest(
  client: VectorCraftClient,
  manifest: JobManifest,
  config: AppConfig
) {
  await verifyVectorCraftSurface(client);

  for (const page of manifest.pages) {
    console.log(
      `Rendering page ${page.page}/${manifest.pages.length}: ` +
      `${page.documentWidthIn}" x ${page.documentHeightIn}"`
    );

    let documentCreated = false;

    try {
      await client.execute("file.new", {
        name: `${manifest.batchId}_P${String(page.page).padStart(2, "0")}`,
        width: toPt(page.documentWidthIn),
        height: toPt(page.documentHeightIn),
        artboards: 1,
        colorMode: config.document.colorMode,
        rasterEffectsPpi: config.document.rasterEffectsPpi
      });

      documentCreated = true;

      // Record the sole empty layer created by file.new before adding production layers.
      const starterLayerId = await getStarterLayerId(client);

      const artworkLayer = await createLayer(
        client,
        "Print"
      );

      const cutLayer = await createLayer(
        client,
        "Cut"
      );

      const regLayer = await createLayer(
        client,
        "Registration"
      );

      // Physically remove the empty Layer 1 before either PDF is exported.
      await deleteStarterLayer(client, starterLayerId, regLayer);
      await assertExactlyLayers(client, ["Registration", "Print", "Cut"]);

      await client.execute("layer.setCurrent", {
        id: artworkLayer
      });

      for (const item of page.items) {
        console.log(
          `  artwork: ${item.fileName}` +
          (item.copyIndex !== undefined ? ` (${item.copyIndex}/${item.quantity})` : "")
        );
        await placeArtwork(client, item);
      }

      await client.execute("layer.setCurrent", {
        id: cutLayer
      });

      for (const item of page.items) {
        await drawCutPath(client, item, config);
      }

      await client.execute("layer.setCurrent", {
        id: regLayer
      });

      await drawRegistrationMarks(client, page);

      await setLayerVisibility(
        client,
        {
          artwork: artworkLayer,
          cut: cutLayer,
          reg: regLayer
        },
        "print"
      );

      // PRINT retains the named Print + Registration layers. Cut is hidden.
      await assertExactlyLayers(client, ["Registration", "Print", "Cut"]);
      console.log(`  PRINT -> ${page.printPdf}`);
      await exportPdf(client, page.printPdf, config);

      // With createLayers=true a hidden Print layer might still appear in the CUT
      // PDF. Delete that layer and all its artwork *before* making the CUT PDF.
      // Registration and Cut are never rebuilt, keeping their exact geometry.
      await deletePrintLayerBeforeCut(client, artworkLayer, cutLayer, regLayer);

      console.log(`  CUT   -> ${page.cutPdf}`);
      await exportPdf(client, page.cutPdf, config);
    } finally {
      if (documentCreated) {
        try {
          await closeWithoutSaving(client);
        } catch (error) {
          console.warn(
            "Warning: temporary VectorCraft document could not be closed automatically:",
            error
          );
        }
      }
    }
  }
}
