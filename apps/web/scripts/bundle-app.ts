#!/usr/bin/env bun
/**
 * @file Copies the SPA build into the worker's asset directory.
 *
 * The app builds to `apps/app/dist` with its bundles under `_app/`. Its shell
 * (`index.html`) lands at `_app/index.html`, where `worker.ts` fetches it for
 * every app route; its bundles and public files sit beside Astro's output so
 * ASSETS serves them directly at the edge.
 */

import {
  cp,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appDist = fileURLToPath(new URL("../../app/dist/", import.meta.url));
const client = fileURLToPath(new URL("../dist/client/", import.meta.url));

try {
  await stat(`${appDist}index.html`);
} catch {
  console.error(`Missing ${appDist}index.html – build apps/app first.`);
  process.exit(1);
}

await mkdir(`${client}_app`, { recursive: true });

for (const entry of await readdir(appDist)) {
  // Astro's `_headers` (immutable caching for `/_astro/*`) stays; the app's
  // copy would only duplicate rules for `/_app/assets/*`, added below.
  if (entry === "_headers") continue;
  const target = entry === "index.html" ? "_app/index.html" : entry;
  await cp(`${appDist}${entry}`, `${client}${target}`, {
    recursive: true,
    force: true,
  });
}

const headers = `${client}_headers`;
const existing = await readFile(headers, "utf8").catch(() => "");
if (!existing.includes("/_app/assets/*")) {
  await writeFile(
    headers,
    `${existing.trimEnd()}\n\n/_app/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
  );
}

console.log(`Bundled app build into ${client}`);
