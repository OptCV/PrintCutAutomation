import { askQuantity, expandCopies, resolveQuantityInput } from "./quantities";
import { testLayerLifecycle } from "./vectorcraft/layers.selftest";
import type { AppConfig, SourceAsset } from "./types";
import { buildManifest } from "./layout";
import { validateManifest } from "./validate-manifest";

const config: AppConfig = {
  workspaceRoot: "D:/PrintCut",
  vectorcraftExe: "C:/Program Files/VectorCraft/vectorcraft.exe",
  controlHost: "127.0.0.1",
  controlPort: 7979,
  launchVectorCraftIfNeeded: true,
  defaults: {
    maxPdfWidthIn: 48,
    bleedIn: 0.125,
    itemGapIn: 0.5,
    allowRotation: true
  },
  registration: {
    diameterIn: 0.25,
    offsetFromArtworkIn: 0.25,
    extraMarksAfterIn: 48,
    extraMarkSpacingIn: 42
  },
  cutLine: {
    strokeWidthPt: 1,
    cmyk: { c: 0, m: 100, y: 100, k: 0 }
  },
  document: {
    colorMode: "cmyk",
    rasterEffectsPpi: 300
  },
  dropSettleMs: 4000
};

const assets: SourceAsset[] = [
  {
    id: "a",
    fileName: "A_40x50.png",
    sourcePath: "D:/PrintCut/inbox/A_40x50.png",
    sourcePage: 1,
    finishedWidthIn: 40,
    finishedHeightIn: 50
  },
  {
    id: "b",
    fileName: "B_35x26.25.png",
    sourcePath: "D:/PrintCut/inbox/B_35x26.25.png",
    sourcePage: 1,
    finishedWidthIn: 35,
    finishedHeightIn: 26.25
  },
  {
    id: "c",
    fileName: "C_24x16.11.png",
    sourcePath: "D:/PrintCut/inbox/C_24x16.11.png",
    sourcePage: 1,
    finishedWidthIn: 24,
    finishedHeightIn: 16.11
  }
];

const manifest = buildManifest({
  batchId: "SELFTEST",
  assets,
  maxPdfWidthIn: 48,
  maxPdfLengthIn: 96,
  bleedIn: 0.125,
  itemGapIn: 0.5,
  allowRotation: true,
  config,
  paths: {
    inbox: "D:/PrintCut/inbox",
    jobs: "D:/PrintCut/jobs",
    output: "D:/PrintCut/output",
    archive: "D:/PrintCut/archive",
    error: "D:/PrintCut/error",
    logs: "D:/PrintCut/logs"
  }
});

validateManifest(manifest);

if (manifest.pages.length !== 1) {
  throw new Error(
    `Expected the known three-item fixture to fit in one 48x96 panel; got ${manifest.pages.length}.`
  );
}

for (const page of manifest.pages) {
  if (
    page.documentWidthIn > 48.001 ||
    page.documentHeightIn > 96.001
  ) {
    throw new Error("Self-test layout exceeded configured limits.");
  }

  for (const mark of page.registrationMarks) {
    if (Math.abs(mark.diameterIn - 0.25) > 0.0001) {
      throw new Error("Registration diameter self-test failed.");
    }
  }

  for (const item of page.items) {
    if (
      Math.abs(
        item.artworkBoundsIn.width -
        (item.cutBoundsIn.width + 0.25)
      ) > 0.001 ||
      Math.abs(
        item.artworkBoundsIn.height -
        (item.cutBoundsIn.height + 0.25)
      ) > 0.001
    ) {
      throw new Error(
        `Bleed geometry self-test failed for ${item.fileName}.`
      );
    }
  }
}

console.log("SELFTEST PASS");
console.log(
  `Generated ${manifest.pages.length} panel pair(s): ` +
  `${manifest.pages[0].documentWidthIn}" x ` +
  `${manifest.pages[0].documentHeightIn}"`
);

const copies = expandCopies(assets[0], 3);
if (copies.length !== 3 || new Set(copies.map(c => c.id)).size !== 3) {
  throw new Error("Quantity expansion did not produce three unique pieces.");
}
if (new Set(copies.map(c => c.sourcePath)).size !== 1) {
  throw new Error("Quantity expansion did not preserve a shared source.");
}
if (expandCopies(assets[1], 0).length !== 0) {
  throw new Error("Zero quantity did not skip the source.");
}
const repeated = buildManifest({
  batchId: "COPIES_TEST",
  assets: [...copies, assets[1]],
  maxPdfWidthIn: 48,
  maxPdfLengthIn: 96,
  bleedIn: 0.125,
  itemGapIn: 0.5,
  allowRotation: true,
  config,
  paths: {
    inbox: "D:/PrintCut/inbox", jobs: "D:/PrintCut/jobs",
    output: "D:/PrintCut/output", archive: "D:/PrintCut/archive",
    error: "D:/PrintCut/error", logs: "D:/PrintCut/logs"
  }
});
validateManifest(repeated);
const allItems = repeated.pages.flatMap(p => p.items);
if (allItems.length !== 4 || allItems.filter(i => i.copyIndex !== undefined).length !== 3) {
  throw new Error("The nesting manifest did not retain all requested copies.");
}
console.log("QUANTITY SELFTEST PASS: 3 copies + 1 additional piece");

if (resolveQuantityInput("") !== 1 || resolveQuantityInput("   ") !== 1 ||
    resolveQuantityInput("1") !== 1 || resolveQuantityInput("0") !== 0 ||
    resolveQuantityInput("5") !== 5 || resolveQuantityInput("1.5") !== null ||
    resolveQuantityInput("-2") !== null || resolveQuantityInput("1001") !== null ||
    resolveQuantityInput(null) !== 1 || resolveQuantityInput(undefined) !== 1) {
  throw new Error("Quantity input default/validation self-test failed.");
}
if (askQuantity("test.png", () => null) !== 1 ||
    askQuantity("test.png", () => "") !== 1 ||
    askQuantity("test.png", () => "0") !== 0 ||
    askQuantity("test.png", () => "5") !== 5) {
  throw new Error("Interactive quantity prompt default failed.");
}
let attempts = 0;
const recovered = askQuantity("test.png", () => {
  attempts++;
  return attempts === 1 ? "1.5" : "2";
});
if (recovered !== 2 || attempts !== 2) {
  throw new Error("Invalid quantity input did not reprompt correctly.");
}
console.log("QUANTITY INPUT SELFTEST PASS: Enter/null=1, 0=skip, invalid values rejected");

testLayerLifecycle().then(() => {
  console.log("LAYER SELFTEST PASS: starter removed; CUT has no Print layer");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
