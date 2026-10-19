import {
  access,
  mkdir,
  readdir,
  rename,
  stat,
  writeFile,
  readFile
} from "node:fs/promises";
import { extname, resolve } from "node:path";
import { SUPPORTED_EXTENSIONS } from "./config";
import type { Paths } from "./types";

export async function ensureWorkspace(paths: Paths) {
  await Promise.all(
    Object.values(paths).map((path) => mkdir(path, { recursive: true }))
  );
}

export async function listInputFiles(paths: Paths) {
  await ensureWorkspace(paths);
  const entries = await readdir(paths.inbox, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => resolve(paths.inbox, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(path: string, value: unknown) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function fileSignature(files: string[]) {
  const records: string[] = [];

  for (const file of files) {
    const info = await stat(file);
    records.push(`${file}:${info.size}:${info.mtimeMs}`);
  }

  return records.join("|");
}

export async function verifyNonEmptyFiles(files: string[]) {
  const missing: string[] = [];

  for (const file of files) {
    try {
      const info = await stat(file);
      if (!info.isFile() || info.size <= 0) missing.push(file);
    } catch {
      missing.push(file);
    }
  }

  if (missing.length) {
    throw new Error(
      "Required output file(s) are missing or empty:\n" +
      missing.map((file) => `  - ${file}`).join("\n")
    );
  }
}

export async function archiveSources(
  inputFiles: string[],
  paths: Paths,
  batchId: string
) {
  const destination = resolve(paths.archive, batchId);
  await mkdir(destination, { recursive: true });

  for (const source of inputFiles) {
    const name = source.split(/[\\/]/).pop()!;
    await rename(source, resolve(destination, name));
  }

  return destination;
}
