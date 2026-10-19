export type Cmyk = { c: number; m: number; y: number; k: number };

export type AppConfig = {
  workspaceRoot: string;
  vectorcraftExe: string;
  controlHost: string;
  controlPort: number;
  launchVectorCraftIfNeeded: boolean;
  defaults: {
    maxPdfWidthIn: number;
    bleedIn: number;
    itemGapIn: number;
    allowRotation: boolean;
    /** Files intentionally skipped by a zero quantity. */
    skippedSourcePaths?: string[];
  };
  registration: {
    diameterIn: number;
    offsetFromArtworkIn: number;
    extraMarksAfterIn: number;
    extraMarkSpacingIn: number;
  };
  cutLine: {
    strokeWidthPt: number;
    cmyk: Cmyk;
  };
  document: {
    colorMode: "rgb" | "cmyk";
    rasterEffectsPpi: number;
  };
  /** Preserve named layers in exported PDF. Switch off for RIP compatibility. */
  pdf?: {
    createLayers: boolean;
    preserveEditing: boolean;
  };
  dropSettleMs: number;
};

export type Paths = {
  inbox: string;
  jobs: string;
  output: string;
  archive: string;
  error: string;
  logs: string;
};

export type SourceAsset = {
  id: string;
  fileName: string;
  sourcePath: string;
  sourcePage: number;
  finishedWidthIn: number;
  finishedHeightIn: number;
  /** Index of this printed piece among copies of its source, starting at 1. */
  copyIndex?: number;
  /** Total requested copies of this source. */
  quantity?: number;
};

export type PackRect = {
  itemId: string;
  width: number;
  height: number;
};

export type PackedRect = PackRect & {
  x: number;
  y: number;
  rotated: boolean;
};

export type RegMark = {
  x: number;
  y: number;
  diameterIn: number;
};

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutItem = {
  id: string;
  fileName: string;
  sourcePath: string;
  sourcePage: number;
  rotated: boolean;
  copyIndex?: number;
  quantity?: number;
  finishedSizeIn: { width: number; height: number };
  artworkBoundsIn: Bounds;
  cutBoundsIn: Bounds;
};

export type LayoutPage = {
  page: number;
  documentWidthIn: number;
  documentHeightIn: number;
  artworkAreaBoundsIn: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  items: LayoutItem[];
  registrationMarks: RegMark[];
  printPdf: string;
  cutPdf: string;
};

export type JobManifest = {
  version: 1;
  batchId: string;
  createdAt: string;
  input: {
    maxPdfWidthIn: number;
    maxPdfLengthIn: number;
    bleedIn: number;
    itemGapIn: number;
    allowRotation: boolean;
    /** Files intentionally skipped by a zero quantity. */
    skippedSourcePaths?: string[];
  };
  registration: {
    diameterIn: number;
    offsetFromArtworkIn: number;
    extraMarksAfterIn: number;
    extraMarkSpacingIn: number;
    color: "100K";
  };
  rules: {
    filenameDimensionsAreFinishedSize: true;
    cutPathIsFinishedSize: true;
    artworkExtendsByBleed: true;
    printCutUseIdenticalGeometry: true;
    printCutLinesHidden: true;
    cutArtworkHidden: true;
  };
  pages: LayoutPage[];
};

export type VectorCraftResponse<T = unknown> = {
  id: number;
  ok: boolean;
  result?: T;
  error?: unknown;
};
