import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AppConfig, Paths } from "./types";

export async function loadConfig(): Promise<AppConfig> {
  const configPath = resolve(process.cwd(), "config.json");

  try {
    return JSON.parse(await readFile(configPath, "utf8")) as AppConfig;
  } catch (error) {
    throw new Error(
      `Could not read ${configPath}. Copy config.example.json to config.json first.\n` +
      String(error)
    );
  }
}

export function getPaths(config: AppConfig): Paths {
  return {
    inbox: resolve(config.workspaceRoot, "inbox"),
    jobs: resolve(config.workspaceRoot, "jobs"),
    output: resolve(config.workspaceRoot, "output"),
    archive: resolve(config.workspaceRoot, "archive"),
    error: resolve(config.workspaceRoot, "error"),
    logs: resolve(config.workspaceRoot, "logs")
  };
}

export const SUPPORTED_EXTENSIONS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp",
  ".gif", ".webp", ".svg", ".svgz", ".ai", ".eps", ".emf", ".wmf"
]);

export const POINTS_PER_INCH = 72;
