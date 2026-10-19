import { loadConfig } from "./config";
import {
  commandId,
  normalizeCommandList,
  REQUIRED_COMMANDS
} from "./vectorcraft/commands";
import { connectOrLaunchVectorCraft } from "./vectorcraft/runtime";

const config = await loadConfig();

console.log(
  `Connecting to VectorCraft at ` +
  `${config.controlHost}:${config.controlPort}...`
);

const { client, launched } =
  await connectOrLaunchVectorCraft(config);

try {
  console.log(
    launched
      ? "VectorCraft started successfully."
      : "Connected to an existing VectorCraft control server."
  );

  const ui = await client.request("ui.inspect");
  console.log("Control protocol: OK");

  const raw = await client.commands();
  const commands = normalizeCommandList(raw);
  const byId = new Map(
    commands.map((command) => [
      commandId(command),
      command
    ])
  );

  console.log(
    `Engine command registry: ${commands.length} command(s)`
  );

  const missing = REQUIRED_COMMANDS.filter(
    (id) => !byId.has(id)
  );

  if (missing.length) {
    console.error("");
    console.error("Missing required commands:");
    for (const id of missing) {
      console.error(`  - ${id}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Required command surface: OK");
  }

  console.log("");
  console.log("Required command parameter docs:");

  for (const id of REQUIRED_COMMANDS) {
    const command = byId.get(id);
    if (!command) continue;

    console.log(`\n[${id}]`);
    console.log(
      typeof command.params === "string"
        ? command.params
        : JSON.stringify(command.params ?? null)
    );
  }

  console.log("");
  console.log(
    "Doctor completed without modifying artwork."
  );
} finally {
  client.close();
}
