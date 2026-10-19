import {
  assertExactlyLayers,
  deletePrintLayerBeforeCut,
  deleteStarterLayer,
  getStarterLayerId,
  type LayerCommandClient
} from "./layers";

interface FakeLayer {
  id: number;
  name: string;
  children: unknown[];
  visible: boolean;
}

class FakeVectorCraft implements LayerCommandClient {
  layers: FakeLayer[] = [
    { id: 1, name: "Layer 1", children: [], visible: true }
  ];
  readonly commands: Array<{ name: string; params: Record<string, unknown> }> = [];

  async inspect(): Promise<unknown> {
    return { layers: this.layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      children: layer.children,
      childCount: layer.children.length
    })) };
  }

  async execute<T = unknown>(
    name: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    this.commands.push({ name, params });
    switch (name) {
      case "layer.setCurrent": {
        if (!this.layers.some(layer => layer.id === params.id)) {
          throw new Error(`Unknown current layer ID: ${params.id}`);
        }
        break;
      }
      case "layer.delete": {
        const ids = params.ids;
        if (!Array.isArray(ids) || ids.length !== 1) {
          throw new Error("Expected exactly one layer ID for deletion.");
        }
        const target = ids[0];
        if (this.layers.length < 2) throw new Error("Cannot delete last layer.");
        const index = this.layers.findIndex(layer => layer.id === target);
        if (index < 0) throw new Error("Unknown layer ID for deletion.");
        this.layers.splice(index, 1);
        break;
      }
      case "layer.setProps": {
        const layer = this.layers.find(layer => layer.id === params.id);
        if (!layer) throw new Error("Cannot set properties on removed layer.");
        if (typeof params.visible === "boolean") layer.visible = params.visible;
        break;
      }
      default: throw new Error(`Unexpected mock command: ${name}`);
    }
    return {} as T;
  }
}

export async function testLayerLifecycle() {
  const fake = new FakeVectorCraft();
  const starterId = await getStarterLayerId(fake);
  if (starterId !== 1) throw new Error("Did not identify original Layer 1.");

  fake.layers.push(
    { id: 2, name: "Print", children: ["image"], visible: true },
    { id: 3, name: "Cut", children: ["rectangle"], visible: false },
    { id: 4, name: "Registration", children: ["circle"], visible: true }
  );
  await deleteStarterLayer(fake, starterId, 4);
  await assertExactlyLayers(fake, ["Print", "Cut", "Registration"]);

  // Emulate PRINT PDF created; then remove its content before CUT export.
  await deletePrintLayerBeforeCut(fake, 2, 3, 4);
  await assertExactlyLayers(fake, ["Cut", "Registration"]);

  const deletedIds = fake.commands
    .filter(command => command.name === "layer.delete")
    .flatMap(command => command.params.ids as number[]);
  if (JSON.stringify(deletedIds) !== JSON.stringify([1, 2])) {
    throw new Error("Wrong layer IDs deleted.");
  }

  if (!fake.layers.some(layer => layer.id === 3 && layer.visible)) {
    throw new Error("Cut layer not visible after Print deletion.");
  }
  if (!fake.layers.some(layer => layer.id === 4 && layer.visible)) {
    throw new Error("Registration layer not visible after Print deletion.");
  }
}
