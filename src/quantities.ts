import type { SourceAsset } from "./types";

/** Expand a source asset into independently nestable copies of its artwork. */
export function expandCopies(
  asset: Omit<SourceAsset, "copyIndex" | "quantity">,
  quantity: number
): SourceAsset[] {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1000) {
    throw new Error("Quantity must be a whole number between 0 and 1000.");
  }
  return Array.from({ length: quantity }, (_, i) => ({
    ...asset,
    id: `${asset.id}-copy-${String(i + 1).padStart(3, "0")}`,
    copyIndex: i + 1,
    quantity
  }));
}

/** Blank/Enter always means one copy. Explicit zero skips the source. */
export function resolveQuantityInput(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return 1;
  const raw = input.trim();
  if (raw === "") return 1;
  // Restrict input to plain non-negative whole numbers. Reject decimals, signs and exponents.
  if (!/^\d+$/.test(raw)) return null;
  const count = Number(raw);
  if (!Number.isSafeInteger(count) || count < 0 || count > 1000) return null;
  return count;
}

/** Explicitly displays [1] and reprompts on invalid input. */
export function askQuantity(
  fileName: string,
  readPrompt: (message: string) => string | null = prompt
): number {
  for (;;) {
    const raw = readPrompt(
      `  Number of copies for ${fileName} [1] (Enter = 1; type 0 to skip):`
    );
    const count = resolveQuantityInput(raw);
    if (count !== null) return count;
    console.log("Please enter a whole number from 0 to 1000 (Enter = 1).");
  }
}
