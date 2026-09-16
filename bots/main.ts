/**
 * Bot runner CLI.
 *
 *   tsx bots/main.ts daemon          live activity (auto-seeds if empty)
 *   tsx bots/main.ts seed [--force]  backfill fake history once
 *   tsx bots/main.ts purge           remove all bot accounts and content
 */

import { closeDb } from "../src/lib/mongo";
import { runDaemon } from "./daemon";
import { purgeBotData } from "./registry";
import { runSeed } from "./seed";

const HELP = `usage: tsx bots/main.ts <command>

commands:
  daemon          run the live-activity loop (auto-seeds when empty)
  seed [--force]  create bots + backdated history, then exit
  purge           delete all bot accounts, content and engagement`;

async function main(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    console.error(
      "MONGODB_URI is not set — point it at the stack's Mongo, e.g.\n" +
        "  docker compose --profile bots run --rm bots npx tsx bots/main.ts seed",
    );
    process.exit(1);
  }

  try {
    const command = process.argv[2] ?? "daemon";
    switch (command) {
      case "daemon":
        await runDaemon();
        break;
      case "seed":
        await runSeed({ force: process.argv.includes("--force") });
        break;
      case "purge":
        await purgeBotData();
        break;
      default:
        console.log(HELP);
        process.exitCode = command === "help" ? 0 : 1;
    }
  } finally {
    // One-shot commands must not hang on the open Mongo connection pool.
    await closeDb();
  }
}

main().catch((err) => {
  console.error(`[bots] fatal: ${(err as Error).stack ?? err}`);
  process.exit(1);
});
