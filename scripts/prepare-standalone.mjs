import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const copies = [
  [".next/static", ".next/standalone/.next/static"],
  ["public", ".next/standalone/public"],
];

for (const [source, destination] of copies) {
  const sourcePath = resolve(source);
  if (!existsSync(sourcePath)) {
    if (source === "public") continue;
    throw new Error(`Required standalone asset directory is missing: ${source}`);
  }

  const destinationPath = resolve(destination);
  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { recursive: true, force: true });
}

console.log("Standalone static assets prepared.");
