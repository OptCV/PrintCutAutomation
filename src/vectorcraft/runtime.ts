import { access } from "node:fs/promises";
import type { AppConfig } from "../types";
import { VectorCraftClient } from "./client";

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function tryConnect(config: AppConfig) {
  const client = new VectorCraftClient(
    config.controlHost,
    config.controlPort
  );

  try {
    await client.connect();
    return client;
  } catch {
    client.close();
    return null;
  }
}

export async function connectOrLaunchVectorCraft(
  config: AppConfig
): Promise<{
  client: VectorCraftClient;
  launched: boolean;
}> {
  const existing = await tryConnect(config);

  if (existing) {
    return {
      client: existing,
      launched: false
    };
  }

  if (!config.launchVectorCraftIfNeeded) {
    throw new Error(
      `VectorCraft is not listening on ` +
      `${config.controlHost}:${config.controlPort}. ` +
      `Start it with --control ${config.controlPort} or enable launchVectorCraftIfNeeded.`
    );
  }

  if (!(await pathExists(config.vectorcraftExe))) {
    throw new Error(
      `VectorCraft executable not found:\n${config.vectorcraftExe}`
    );
  }

  Bun.spawn(
    [
      config.vectorcraftExe,
      "--control",
      String(config.controlPort),
      "--automation-read-root",
      config.workspaceRoot,
      "--automation-write-root",
      config.workspaceRoot
    ],
    {
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit"
    }
  );

  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    await Bun.sleep(500);

    const client = await tryConnect(config);
    if (client) {
      return {
        client,
        launched: true
      };
    }
  }

  throw new Error(
    `VectorCraft did not become ready on ` +
    `${config.controlHost}:${config.controlPort} within 30 seconds.`
  );
}
