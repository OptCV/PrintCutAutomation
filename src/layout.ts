import { basename, resolve } from "node:path";
import { packBest } from "./maxrects";
import type {
  AppConfig,
  JobManifest,
  LayoutItem,
  LayoutPage,
  PackRect,
  Paths,
  RegMark,
  SourceAsset
} from "./types";

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}

function createRegistrationMarks(args: {
  artLeft: number;
  artTop: number;
  artRight: number;
  artBottom: number;
  diameter: number;
  offset: number;
  extraAfter: number;
  extraSpacing: number;
}) {
  const {
    artLeft,
    artTop,
    artRight,
    artBottom,
    diameter: d,
    offset: o,
    extraAfter,
    extraSpacing
  } = args;

  const marks: RegMark[] = [];
  const leftX = artLeft - o - d;
  const rightX = artRight + o;
  const topY = artTop - o - d;
  const bottomY = artBottom + o;

  const add = (x: number, y: number) => {
    marks.push({
      x: round(x),
      y: round(y),
      diameterIn: d
    });
  };

  add(leftX, topY);
  add(rightX, topY);
  add(leftX, bottomY);
  add(rightX, bottomY);

  const width = artRight - artLeft;
  const height = artBottom - artTop;

  if (width <= height) {
    add(
      artLeft + width * 0.25 - d / 2,
      topY
    );
  } else {
    add(
      leftX,
      artTop + height * 0.25 - d / 2
    );
  }

  if (width >= height && width > extraAfter) {
    for (
      let x = extraSpacing;
      x < width;
      x += extraSpacing
    ) {
      add(artLeft + x - d / 2, topY);
      add(artLeft + x - d / 2, bottomY);
    }
  }

  if (height > width && height > extraAfter) {
    for (
      let y = extraSpacing;
      y < height;
      y += extraSpacing
    ) {
      add(leftX, artTop + y - d / 2);
      add(rightX, artTop + y - d / 2);
    }
  }

  return marks;
}

export function buildManifest(args: {
  batchId: string;
  assets: SourceAsset[];
  maxPdfWidthIn: number;
  maxPdfLengthIn: number;
  bleedIn: number;
  itemGapIn: number;
  allowRotation: boolean;
  config: AppConfig;
  paths: Paths;
}): JobManifest {
  const regDiameter = args.config.registration.diameterIn;
  const regOffset = args.config.registration.offsetFromArtworkIn;
  const regMargin = regOffset + regDiameter;

  const usableWidth =
    args.maxPdfWidthIn - regMargin * 2;

  const usableHeight =
    args.maxPdfLengthIn - regMargin * 2;

  if (usableWidth <= 0 || usableHeight <= 0) {
    throw new Error(
      "Maximum PDF width/length is too small for registration marks."
    );
  }

  const packRects: PackRect[] = args.assets.map(
    (asset) => ({
      itemId: asset.id,
      width:
        asset.finishedWidthIn +
        args.bleedIn * 2 +
        args.itemGapIn,
      height:
        asset.finishedHeightIn +
        args.bleedIn * 2 +
        args.itemGapIn
    })
  );

  const packed = packBest(
    packRects,
    usableWidth,
    usableHeight,
    args.allowRotation
  );

  const assetById = new Map(
    args.assets.map((asset) => [asset.id, asset])
  );

  const pages: LayoutPage[] = packed.bins.map(
    (binItems, pageIndex) => {
      const pad = args.itemGapIn / 2;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      const items: LayoutItem[] = binItems.map(
        (packedItem) => {
          const asset = assetById.get(
            packedItem.itemId
          );

          if (!asset) {
            throw new Error(
              `Unknown packed item: ${packedItem.itemId}`
            );
          }

          const finishedW = packedItem.rotated
            ? asset.finishedHeightIn
            : asset.finishedWidthIn;

          const finishedH = packedItem.rotated
            ? asset.finishedWidthIn
            : asset.finishedHeightIn;

          const artWidth =
            finishedW + args.bleedIn * 2;

          const artHeight =
            finishedH + args.bleedIn * 2;

          const artX =
            regMargin + packedItem.x + pad;

          const artY =
            regMargin + packedItem.y + pad;

          const cutX = artX + args.bleedIn;
          const cutY = artY + args.bleedIn;

          minX = Math.min(minX, artX);
          minY = Math.min(minY, artY);
          maxX = Math.max(maxX, artX + artWidth);
          maxY = Math.max(maxY, artY + artHeight);

          return {
            id: asset.id,
            fileName: basename(asset.sourcePath),
            sourcePath: asset.sourcePath,
            sourcePage: asset.sourcePage,
            rotated: packedItem.rotated,
            copyIndex: asset.copyIndex,
            quantity: asset.quantity,
            finishedSizeIn: {
              width: asset.finishedWidthIn,
              height: asset.finishedHeightIn
            },
            artworkBoundsIn: {
              x: round(artX),
              y: round(artY),
              width: round(artWidth),
              height: round(artHeight)
            },
            cutBoundsIn: {
              x: round(cutX),
              y: round(cutY),
              width: round(finishedW),
              height: round(finishedH)
            }
          };
        }
      );

      const marks = createRegistrationMarks({
        artLeft: minX,
        artTop: minY,
        artRight: maxX,
        artBottom: maxY,
        diameter: regDiameter,
        offset: regOffset,
        extraAfter:
          args.config.registration.extraMarksAfterIn,
        extraSpacing:
          args.config.registration.extraMarkSpacingIn
      });

      const documentWidthIn = round(
        (maxX - minX) + regMargin * 2
      );

      const documentHeightIn = round(
        (maxY - minY) + regMargin * 2
      );

      const shiftX = minX - regMargin;
      const shiftY = minY - regMargin;

      for (const item of items) {
        item.artworkBoundsIn.x = round(
          item.artworkBoundsIn.x - shiftX
        );
        item.artworkBoundsIn.y = round(
          item.artworkBoundsIn.y - shiftY
        );
        item.cutBoundsIn.x = round(
          item.cutBoundsIn.x - shiftX
        );
        item.cutBoundsIn.y = round(
          item.cutBoundsIn.y - shiftY
        );
      }

      for (const mark of marks) {
        mark.x = round(mark.x - shiftX);
        mark.y = round(mark.y - shiftY);
      }

      const page = pageIndex + 1;
      const suffix = String(page).padStart(2, "0");

      return {
        page,
        documentWidthIn,
        documentHeightIn,
        artworkAreaBoundsIn: {
          left: round(minX - shiftX),
          top: round(minY - shiftY),
          right: round(maxX - shiftX),
          bottom: round(maxY - shiftY)
        },
        items,
        registrationMarks: marks,
        printPdf: resolve(
          args.paths.output,
          args.batchId,
          `${args.batchId}_P${suffix}_PRINT.pdf`
        ),
        cutPdf: resolve(
          args.paths.output,
          args.batchId,
          `${args.batchId}_P${suffix}_CUT.pdf`
        )
      };
    }
  );

  return {
    version: 1,
    batchId: args.batchId,
    createdAt: new Date().toISOString(),
    input: {
      maxPdfWidthIn: args.maxPdfWidthIn,
      maxPdfLengthIn: args.maxPdfLengthIn,
      bleedIn: args.bleedIn,
      itemGapIn: args.itemGapIn,
      allowRotation: args.allowRotation
    },
    registration: {
      diameterIn: regDiameter,
      offsetFromArtworkIn: regOffset,
      extraMarksAfterIn:
        args.config.registration.extraMarksAfterIn,
      extraMarkSpacingIn:
        args.config.registration.extraMarkSpacingIn,
      color: "100K"
    },
    rules: {
      filenameDimensionsAreFinishedSize: true,
      cutPathIsFinishedSize: true,
      artworkExtendsByBleed: true,
      printCutUseIdenticalGeometry: true,
      printCutLinesHidden: true,
      cutArtworkHidden: true
    },
    pages
  };
}
