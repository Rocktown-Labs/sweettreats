/**
 * Sync drizzle-generated migrations from src/migrations (the drizzle v0
 * layout Alchemy cannot read — see alchemy's DrizzleV0LayoutError) into the
 * flat migrations/ copy the production deploy consumes
 * (packages/infra/alchemy.run.ts -> migrations: "../../packages/db/migrations").
 *
 * Runs as part of `db:generate`; resolves paths from this file's location so
 * it works from any cwd (vp runs package scripts from the repo root).
 */
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(packageRoot, "src", "migrations");
const targetDir = path.join(packageRoot, "migrations");

mkdirSync(targetDir, { recursive: true });

let copied = 0;
for (const file of readdirSync(sourceDir)) {
  if (file.endsWith(".sql")) {
    copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
    copied += 1;
  }
}

console.log(`sync-migrations: copied ${copied} migration files to ${targetDir}`);
