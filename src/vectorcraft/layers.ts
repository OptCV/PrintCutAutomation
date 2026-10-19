export interface LayerCommandClient {
  execute<T = unknown>(command: string, params?: Record<string, unknown>): Promise<T>;
  inspect(depth?: number, childLimit?: number): Promise<unknown>;
}

export interface DocumentLayer {
  id: number;
  name: string;
  childCount: number;
}

/** Read the authoritative live document tree, not the selected/highlighted rows. */
export function parseDocumentLayers(document: unknown): DocumentLayer[] {
  if (!document || typeof document !== "object" || !("layers" in document)) {
    throw new Error("VectorCraft document.inspect did not return a layers array.");
  }

  const layers = (document as { layers: unknown }).layers;
  if (!Array.isArray(layers)) {
    throw new Error("VectorCraft document.inspect returned an invalid layers array.");
  }

  return layers.map((layer, index) => {
    if (!layer || typeof layer !== "object") {
      throw new Error(`Unexpected document layer at index ${index}.`);
    }

    const data = layer as Record<string, unknown>;
    if (!Number.isSafeInteger(data.id) || (data.id as number) < 0 ||
        typeof data.name !== "string") {
      throw new Error(`Document layer ${index} has an invalid id/name: ${JSON.stringify(layer)}`);
    }

    const childCount = typeof data.childCount === "number"
      ? data.childCount
      : Array.isArray(data.children)
        ? data.children.length
        : 0;

    return { id: data.id as number, name: data.name, childCount };
  });
}

export async function readDocumentLayers(client: LayerCommandClient) {
  return parseDocumentLayers(await client.inspect(1, 50));
}

/**
 * Called immediately after file.new, before creating any production layers.
 * Only a sole empty starter layer can ever be targeted for removal.
 */
export async function getStarterLayerId(client: LayerCommandClient): Promise<number | null> {
  const existing = await readDocumentLayers(client);
  if (existing.length === 0) return null;
  if (existing.length !== 1 || existing[0].childCount !== 0) {
    throw new Error(
      `Cannot safely identify the empty default layer in the new document: ` +
      JSON.stringify(existing)
    );
  }
  return existing[0].id;
}

export async function deleteStarterLayer(
  client: LayerCommandClient,
  starterId: number | null,
  registrationId: number
) {
  if (starterId === null) return;
  if (starterId === registrationId) throw new Error("Refusing to delete Registration.");

  // Ensure the starter layer is not current when deleting it.
  await client.execute("layer.setCurrent", { id: registrationId });
  await client.execute("layer.delete", { ids: [starterId] });
}

export async function deletePrintLayerBeforeCut(
  client: LayerCommandClient,
  printId: number,
  cutId: number,
  registrationId: number
) {
  if (printId === cutId || printId === registrationId || cutId === registrationId) {
    throw new Error("Print, Cut and Registration must have distinct layer IDs.");
  }

  await client.execute("layer.setCurrent", { id: registrationId });
  await client.execute("layer.delete", { ids: [printId] });
  await client.execute("layer.setProps", { id: cutId, visible: true });
  await client.execute("layer.setProps", { id: registrationId, visible: true });
  await assertExactlyLayers(client, ["Registration", "Cut"]);
}

/** Fail closed if the layers about to be exported are not exactly as intended. */
export async function assertExactlyLayers(
  client: LayerCommandClient,
  requiredNames: string[]
) {
  const actual = await readDocumentLayers(client);
  const actualNames = actual.map((entry) => entry.name);
  const expected = [...requiredNames].sort();
  const found = [...actualNames].sort();

  if (JSON.stringify(expected) !== JSON.stringify(found)) {
    throw new Error(
      `Unsafe layer structure before PDF export. Expected ${expected.join(", ")}; ` +
      `found ${found.join(", ") || "(none)"}. Refusing export.`
    );
  }
}
