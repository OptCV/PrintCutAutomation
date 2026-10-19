import type { JobManifest } from "./types";

const EPS = 0.001;

function approx(a: number, b: number) {
  return Math.abs(a - b) <= EPS;
}

function inside(
  x: number,
  y: number,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number
) {
  return (
    x >= -EPS &&
    y >= -EPS &&
    x + width <= pageWidth + EPS &&
    y + height <= pageHeight + EPS
  );
}

export function validateManifest(
  manifest: JobManifest
) {
  if (manifest.pages.length === 0) {
    throw new Error("Manifest contains no output pages.");
  }

  const bleed = manifest.input.bleedIn;
  const regDiameter =
    manifest.registration.diameterIn;

  const outputs = new Set<string>();

  for (const page of manifest.pages) {
    if (
      page.documentWidthIn >
      manifest.input.maxPdfWidthIn + EPS
    ) {
      throw new Error(
        `Page ${page.page} exceeds maximum width: ` +
        `${page.documentWidthIn} > ${manifest.input.maxPdfWidthIn}`
      );
    }

    if (
      page.documentHeightIn >
      manifest.input.maxPdfLengthIn + EPS
    ) {
      throw new Error(
        `Page ${page.page} exceeds maximum length: ` +
        `${page.documentHeightIn} > ${manifest.input.maxPdfLengthIn}`
      );
    }

    if (outputs.has(page.printPdf) || outputs.has(page.cutPdf)) {
      throw new Error(
        `Duplicate output path on page ${page.page}.`
      );
    }

    outputs.add(page.printPdf);
    outputs.add(page.cutPdf);

    for (const item of page.items) {
      const art = item.artworkBoundsIn;
      const cut = item.cutBoundsIn;

      if (
        !approx(art.width, cut.width + bleed * 2) ||
        !approx(art.height, cut.height + bleed * 2) ||
        !approx(cut.x, art.x + bleed) ||
        !approx(cut.y, art.y + bleed)
      ) {
        throw new Error(
          `Bleed/cut geometry mismatch for ${item.fileName} ` +
          `on page ${page.page}.`
        );
      }

      if (
        !inside(
          art.x,
          art.y,
          art.width,
          art.height,
          page.documentWidthIn,
          page.documentHeightIn
        )
      ) {
        throw new Error(
          `Artwork bounds leave the page for ${item.fileName}.`
        );
      }

      if (
        !inside(
          cut.x,
          cut.y,
          cut.width,
          cut.height,
          page.documentWidthIn,
          page.documentHeightIn
        )
      ) {
        throw new Error(
          `Cut bounds leave the page for ${item.fileName}.`
        );
      }
    }

    for (const mark of page.registrationMarks) {
      if (!approx(mark.diameterIn, regDiameter)) {
        throw new Error(
          `Registration diameter mismatch on page ${page.page}.`
        );
      }

      if (
        !inside(
          mark.x,
          mark.y,
          mark.diameterIn,
          mark.diameterIn,
          page.documentWidthIn,
          page.documentHeightIn
        )
      ) {
        throw new Error(
          `Registration mark leaves page ${page.page}: ` +
          `${JSON.stringify(mark)}`
        );
      }
    }

    // Artwork bleed boxes must not overlap one another.
    for (let i = 0; i < page.items.length; i++) {
      const a = page.items[i].artworkBoundsIn;

      for (let j = i + 1; j < page.items.length; j++) {
        const b = page.items[j].artworkBoundsIn;

        const overlap =
          a.x < b.x + b.width - EPS &&
          a.x + a.width > b.x + EPS &&
          a.y < b.y + b.height - EPS &&
          a.y + a.height > b.y + EPS;

        if (overlap) {
          throw new Error(
            `Artwork overlap detected on page ${page.page}: ` +
            `${page.items[i].fileName} / ${page.items[j].fileName}`
          );
        }
      }
    }
  }
}
