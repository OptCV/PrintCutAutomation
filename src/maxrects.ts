import type { PackRect, PackedRect } from "./types";

type FreeRect = { x: number; y: number; width: number; height: number };
type Heuristic = "bssf" | "baf" | "blsf" | "bottom-left";
type SortMode = "area" | "max-side" | "width" | "height" | "perimeter";

type Candidate = FreeRect & {
  rotated: boolean;
  score1: number;
  score2: number;
};

type Bin = {
  items: PackedRect[];
  freeRects: FreeRect[];
  usedWidth: number;
  usedHeight: number;
};

export type PackingResult = {
  bins: PackedRect[][];
  usedSizes: Array<{ width: number; height: number }>;
  heuristic: Heuristic;
  sortMode: SortMode;
};

function intersects(a: FreeRect, b: FreeRect) {
  return !(
    b.x >= a.x + a.width ||
    b.x + b.width <= a.x ||
    b.y >= a.y + a.height ||
    b.y + b.height <= a.y
  );
}

function containedIn(a: FreeRect, b: FreeRect) {
  return (
    a.x >= b.x &&
    a.y >= b.y &&
    a.x + a.width <= b.x + b.width &&
    a.y + a.height <= b.y + b.height
  );
}

function prune(rects: FreeRect[]) {
  return rects.filter(
    (rect, i) =>
      !rects.some(
        (other, j) => i !== j && containedIn(rect, other)
      )
  );
}

function splitFreeRects(freeRects: FreeRect[], used: FreeRect) {
  const next: FreeRect[] = [];

  for (const free of freeRects) {
    if (!intersects(free, used)) {
      next.push(free);
      continue;
    }

    if (used.x > free.x) {
      next.push({
        x: free.x,
        y: free.y,
        width: used.x - free.x,
        height: free.height
      });
    }

    if (used.x + used.width < free.x + free.width) {
      next.push({
        x: used.x + used.width,
        y: free.y,
        width: free.x + free.width - (used.x + used.width),
        height: free.height
      });
    }

    if (used.y > free.y) {
      next.push({
        x: free.x,
        y: free.y,
        width: free.width,
        height: used.y - free.y
      });
    }

    if (used.y + used.height < free.y + free.height) {
      next.push({
        x: free.x,
        y: used.y + used.height,
        width: free.width,
        height: free.y + free.height - (used.y + used.height)
      });
    }
  }

  return prune(next);
}

function scoreCandidate(
  free: FreeRect,
  width: number,
  height: number,
  heuristic: Heuristic
) {
  const dx = free.width - width;
  const dy = free.height - height;
  const shortSide = Math.min(dx, dy);
  const longSide = Math.max(dx, dy);
  const areaFit = free.width * free.height - width * height;

  switch (heuristic) {
    case "baf":
      return [areaFit, shortSide] as const;
    case "blsf":
      return [longSide, shortSide] as const;
    case "bottom-left":
      return [free.y + height, free.x] as const;
    default:
      return [shortSide, longSide] as const;
  }
}

function findBestPlacement(
  rect: PackRect,
  bin: Bin,
  allowRotation: boolean,
  heuristic: Heuristic
): Candidate | null {
  let best: Candidate | null = null;

  const options = [
    { width: rect.width, height: rect.height, rotated: false }
  ];

  if (allowRotation && Math.abs(rect.width - rect.height) > 1e-9) {
    options.push({
      width: rect.height,
      height: rect.width,
      rotated: true
    });
  }

  for (const free of bin.freeRects) {
    for (const option of options) {
      if (option.width > free.width || option.height > free.height) {
        continue;
      }

      const [score1, score2] = scoreCandidate(
        free,
        option.width,
        option.height,
        heuristic
      );

      const candidate: Candidate = {
        x: free.x,
        y: free.y,
        width: option.width,
        height: option.height,
        rotated: option.rotated,
        score1,
        score2
      };

      if (
        !best ||
        candidate.score1 < best.score1 ||
        (
          candidate.score1 === best.score1 &&
          candidate.score2 < best.score2
        )
      ) {
        best = candidate;
      }
    }
  }

  return best;
}

function place(bin: Bin, rect: PackRect, candidate: Candidate) {
  const used: FreeRect = {
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height
  };

  bin.freeRects = splitFreeRects(bin.freeRects, used);

  bin.items.push({
    ...rect,
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
    rotated: candidate.rotated
  });

  bin.usedWidth = Math.max(
    bin.usedWidth,
    candidate.x + candidate.width
  );

  bin.usedHeight = Math.max(
    bin.usedHeight,
    candidate.y + candidate.height
  );
}

function orderItems(items: PackRect[], mode: SortMode) {
  return [...items].sort((a, b) => {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    const maxA = Math.max(a.width, a.height);
    const maxB = Math.max(b.width, b.height);

    switch (mode) {
      case "max-side":
        return maxB - maxA || areaB - areaA;
      case "width":
        return b.width - a.width || areaB - areaA;
      case "height":
        return b.height - a.height || areaB - areaA;
      case "perimeter":
        return (
          (b.width + b.height) -
          (a.width + a.height) ||
          areaB - areaA
        );
      default:
        return areaB - areaA || maxB - maxA;
    }
  });
}

function packOneStrategy(
  items: PackRect[],
  maxWidth: number,
  maxHeight: number,
  allowRotation: boolean,
  heuristic: Heuristic,
  sortMode: SortMode
): PackingResult {
  const bins: Bin[] = [];

  for (const rect of orderItems(items, sortMode)) {
    const normalFits =
      rect.width <= maxWidth &&
      rect.height <= maxHeight;

    const rotatedFits =
      allowRotation &&
      rect.height <= maxWidth &&
      rect.width <= maxHeight;

    if (!normalFits && !rotatedFits) {
      throw new Error(
        `Item ${rect.itemId} cannot fit inside ` +
        `${maxWidth.toFixed(3)} x ${maxHeight.toFixed(3)} in, ` +
        `even with 90-degree rotation.`
      );
    }

    let selected:
      | { bin: Bin; candidate: Candidate }
      | null = null;

    for (const bin of bins) {
      const candidate = findBestPlacement(
        rect,
        bin,
        allowRotation,
        heuristic
      );

      if (!candidate) continue;

      if (
        !selected ||
        candidate.score1 < selected.candidate.score1 ||
        (
          candidate.score1 === selected.candidate.score1 &&
          candidate.score2 < selected.candidate.score2
        )
      ) {
        selected = { bin, candidate };
      }
    }

    if (!selected) {
      const bin: Bin = {
        items: [],
        freeRects: [{
          x: 0,
          y: 0,
          width: maxWidth,
          height: maxHeight
        }],
        usedWidth: 0,
        usedHeight: 0
      };

      bins.push(bin);

      const candidate = findBestPlacement(
        rect,
        bin,
        allowRotation,
        heuristic
      );

      if (!candidate) {
        throw new Error(
          `Unexpected packing failure for ${rect.itemId}.`
        );
      }

      selected = { bin, candidate };
    }

    place(selected.bin, rect, selected.candidate);
  }

  return {
    bins: bins.map((bin) => bin.items),
    usedSizes: bins.map((bin) => ({
      width: bin.usedWidth,
      height: bin.usedHeight
    })),
    heuristic,
    sortMode
  };
}

function comparePacking(a: PackingResult, b: PackingResult) {
  if (a.bins.length !== b.bins.length) {
    return a.bins.length - b.bins.length;
  }

  const areaA = a.usedSizes.reduce(
    (sum, size) => sum + size.width * size.height,
    0
  );

  const areaB = b.usedSizes.reduce(
    (sum, size) => sum + size.width * size.height,
    0
  );

  if (Math.abs(areaA - areaB) > 1e-9) {
    return areaA - areaB;
  }

  const lengthA = a.usedSizes.reduce(
    (sum, size) => sum + size.height,
    0
  );

  const lengthB = b.usedSizes.reduce(
    (sum, size) => sum + size.height,
    0
  );

  return lengthA - lengthB;
}

export function packBest(
  items: PackRect[],
  maxWidth: number,
  maxHeight: number,
  allowRotation: boolean
): PackingResult {
  const heuristics: Heuristic[] = [
    "bssf",
    "baf",
    "blsf",
    "bottom-left"
  ];

  const sortModes: SortMode[] = [
    "area",
    "max-side",
    "width",
    "height",
    "perimeter"
  ];

  let best: PackingResult | null = null;

  for (const heuristic of heuristics) {
    for (const sortMode of sortModes) {
      const candidate = packOneStrategy(
        items,
        maxWidth,
        maxHeight,
        allowRotation,
        heuristic,
        sortMode
      );

      if (!best || comparePacking(candidate, best) < 0) {
        best = candidate;
      }
    }
  }

  if (!best) {
    throw new Error("Packing produced no result.");
  }

  return best;
}
