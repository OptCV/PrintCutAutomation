export type CommandInfo = {
  id?: string;
  command?: string;
  label?: string;
  params?: unknown;
  enabled?: boolean;
  [key: string]: unknown;
};

export function normalizeCommandList(result: unknown): CommandInfo[] {
  if (Array.isArray(result)) {
    return result as CommandInfo[];
  }

  if (
    result &&
    typeof result === "object" &&
    "commands" in result &&
    Array.isArray((result as { commands: unknown }).commands)
  ) {
    return (result as { commands: CommandInfo[] }).commands;
  }

  return [];
}

export function commandId(command: CommandInfo): string {
  return String(command.id ?? command.command ?? "");
}

export const REQUIRED_COMMANDS = [
  "file.new",
  "file.place",
  "file.place.info",
  "layer.new",
  "layer.setCurrent",
  "layer.setProps",
  "layer.delete",
  "shape.rectangle",
  "shape.ellipse",
  "paint.setFill",
  "paint.setStroke",
  "stroke.set",
  "select.set",
  "object.rotate",
  "object.clippingMask.make",
  "file.close"
] as const;
