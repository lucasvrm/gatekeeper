import { init } from "./commands/init.js";
import { verify } from "./commands/verify.js";
import { status } from "./commands/status.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HELP = `
  orqui — UI Layout Designer CLI

  Usage:
    npx orqui <command>

  Commands:
    init       Setup Orqui in current project
    verify     Check integrity of installed contracts
    status     Show installed contract versions

  Options:
    --help     Show this help
    --version  Show version
`;

export function cli(args) {
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP);
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
    console.log(pkg.version);
    process.exit(0);
  }

  const commands = { init, verify, status };
  const fn = commands[command];

  if (!fn) {
    console.error(`Unknown command: ${command}`);
    console.log(HELP);
    process.exit(1);
  }

  fn(args.slice(1));
}
