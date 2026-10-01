#!/usr/bin/env bun

/**
 * @file Deploys one copy of the worker, programmatically.
 *
 * The repo is a template: `apps/web/wrangler.jsonc` holds the shape of a
 * deployment and nothing that belongs to one account. This script adds the
 * per-deployment values and uploads. It is the same entry point for all
 * three deployers:
 *
 *   - a person, with values in the git-ignored `.env.local` (Bun loads it);
 *   - CI, with values in GitHub environment secrets and variables;
 *   - the platform, deploying a customer's copy with values from its database.
 *
 * Steps:
 *   1. build (unless --skip-build), with `CLOUDFLARE_ENV` selecting the
 *      Wrangler environment the adapter resolves into dist/server/wrangler.json;
 *   2. Hyperdrive: use the IDs given, else find-or-create two configs named
 *      after the worker from the database URL, so the worker reaches Postgres
 *      through Cloudflare's pool wherever the visitor is;
 *   3. write a resolved config beside the generated one – name, APP_ORIGIN,
 *      Hyperdrive bindings;
 *   4. upload, standalone on workers.dev or into a Workers for Platforms
 *      dispatch namespace (--namespace);
 *   5. set the worker's secrets through the REST API.
 *
 * Usage:
 *   bun scripts/deploy.ts [--env staging|production] [--name cust-acme]
 *     [--origin https://host] [--database-url postgres://... |
 *      --hyperdrive-cached-id ID --hyperdrive-uncached-id ID]
 *     [--namespace customers] [--skip-build] [--dry-run]
 *
 * Every flag falls back to an environment variable: APP_ORIGIN, DATABASE_URL,
 * HYPERDRIVE_CACHED_ID, HYPERDRIVE_UNCACHED_ID. Always from the environment:
 * CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (the deployer's, never a
 * customer's), BETTER_AUTH_SECRET, RESEND_API_KEY.
 *
 * `--dry-run` skips every network call, still writes the resolved config, and
 * asks Wrangler to bundle it, so the artifact and config are validated offline.
 */

import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    env: { type: "string", default: "production" },
    name: { type: "string" },
    origin: { type: "string" },
    "database-url": { type: "string" },
    "hyperdrive-cached-id": { type: "string" },
    "hyperdrive-uncached-id": { type: "string" },
    namespace: { type: "string" },
    "skip-build": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const environment = args.env;
if (environment !== "production" && environment !== "staging") {
  fail("--env must be production or staging");
}
const dryRun = args["dry-run"];
const namespace = args.namespace;

const origin =
  args.origin ??
  process.env.APP_ORIGIN ??
  fail("--origin or APP_ORIGIN is required");
if (!/^https?:\/\/[^/]+$/.test(origin)) {
  fail("--origin must be a bare origin such as https://app.example.com");
}

const givenIds = {
  cached: args["hyperdrive-cached-id"] ?? process.env.HYPERDRIVE_CACHED_ID,
  uncached:
    args["hyperdrive-uncached-id"] ?? process.env.HYPERDRIVE_UNCACHED_ID,
};
const databaseUrl = args["database-url"] ?? process.env.DATABASE_URL;
if (!(givenIds.cached && givenIds.uncached) && !databaseUrl) {
  fail(
    "Give --database-url (Hyperdrive is created from it) or both Hyperdrive IDs.",
  );
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!dryRun && (!accountId || !apiToken)) {
  fail(
    "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or use --dry-run).",
  );
}

const secrets: Record<string, string | undefined> = {
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
};
for (const [name, value] of Object.entries(secrets)) {
  if (!value && !dryRun) fail(`${name} is required in the environment.`);
}

const repoRoot = resolve(import.meta.dir, "..");
const serverDir = resolve(repoRoot, "apps/web/dist/server");
const generatedConfig = resolve(serverDir, "wrangler.json");

async function run(
  command: string[],
  env: Record<string, string | undefined> = {},
) {
  console.log(`\n$ ${command.join(" ")}`);
  const child = Bun.spawn(command, {
    cwd: repoRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, ...env },
  });
  if ((await child.exited) !== 0) fail("Command failed.");
}

// --- 1. Build -----------------------------------------------------------------

// Production is Wrangler's top-level config; the adapter selects a named
// environment through CLOUDFLARE_ENV at build time.
if (!args["skip-build"]) {
  await run(["bun", "run", "build"], {
    CLOUDFLARE_ENV: environment === "production" ? undefined : environment,
  });
}

try {
  await access(generatedConfig);
} catch {
  fail(`Missing ${generatedConfig} – build first, or omit --skip-build.`);
}

type WranglerConfig = Record<string, unknown> & {
  name: string;
  vars?: Record<string, string>;
  hyperdrive?: { binding: string; id: string }[];
  secrets?: unknown;
  workers_dev?: boolean;
};

const base = JSON.parse(
  await readFile(generatedConfig, "utf8"),
) as WranglerConfig;
const scriptName = args.name ?? base.name;
if (!/^[a-z0-9-]{1,63}$/.test(scriptName)) {
  fail("--name must be lowercase letters, digits and hyphens");
}

// --- Cloudflare REST helpers -------------------------------------------------

const API = "https://api.cloudflare.com/client/v4";

async function cf<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}/accounts/${accountId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json()) as {
    success: boolean;
    result: T;
    errors: { message: string }[];
  };
  if (!json.success) {
    throw new Error(
      `${method} ${path} failed: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }
  return json.result;
}

// --- 2. Hyperdrive ------------------------------------------------------------

type HyperdriveConfig = { id: string; name: string };

// Hyperdrive stores the origin as discrete fields, so split the URL the same
// way `infra/modules/cloudflare/main.tf` does. Anything after `?` is dropped:
// TLS to the origin is Hyperdrive's setting, not the client's.
function parseOrigin(url: string) {
  const match =
    /^postgres(?:ql)?:\/\/([^:@/]+):([^@/]*)@([^:@/?#]+)(?::(\d+))?\/([^?/]+)/.exec(
      url,
    );
  if (!match)
    fail("--database-url must look like postgres://user:pass@host:port/db");
  const [, user, password, host, port, database] = match;
  return {
    scheme: "postgres",
    user,
    password: decodeURIComponent(password),
    host,
    port: port ? Number(port) : 5432,
    database,
  };
}

async function ensureHyperdrive(
  name: string,
  caching: { disabled: boolean },
): Promise<HyperdriveConfig> {
  if (dryRun) return { id: `dry-run-${name}`, name };

  const existing = await cf<HyperdriveConfig[]>("GET", "/hyperdrive/configs");
  const found = existing.find((c) => c.name === name);
  if (found) return found;

  return cf<HyperdriveConfig>("POST", "/hyperdrive/configs", {
    name,
    origin: parseOrigin(databaseUrl!),
    caching,
  });
}

console.log(`\nHyperdrive for ${scriptName}`);
const hyperdrive =
  givenIds.cached && givenIds.uncached
    ? { cached: givenIds.cached, uncached: givenIds.uncached }
    : {
        uncached: (
          await ensureHyperdrive(`${scriptName}-uncached`, { disabled: true })
        ).id,
        cached: (
          await ensureHyperdrive(`${scriptName}-cached`, { disabled: false })
        ).id,
      };
console.log(
  `  uncached: ${hyperdrive.uncached}\n  cached:   ${hyperdrive.cached}`,
);

// --- 3. Resolved config -------------------------------------------------------

const config: WranglerConfig = {
  ...base,
  name: scriptName,
  vars: { ...base.vars, APP_ORIGIN: origin },
  hyperdrive: [
    { binding: "HYPERDRIVE_CACHED", id: hyperdrive.cached },
    { binding: "HYPERDRIVE_UNCACHED", id: hyperdrive.uncached },
  ],
  // A dispatch script has no workers.dev address; a standalone worker needs
  // one unless a custom domain route is configured.
  workers_dev: !namespace,
};
// Wrangler checks required secrets against the target before uploading, and
// a first deploy has none yet. They are set right after the upload instead.
delete config.secrets;

const configPath = resolve(serverDir, `wrangler.${scriptName}.json`);
await writeFile(configPath, JSON.stringify(config, null, 2));
console.log(`\nResolved config: ${configPath}`);

// --- 4. Upload ----------------------------------------------------------------

await run([
  "bun",
  "wrangler",
  "deploy",
  "--config",
  configPath,
  ...(namespace ? ["--dispatch-namespace", namespace] : []),
  // Outside dist/server: the generated config uploads every module under its
  // own directory, so a dry-run output left there would ship next time.
  ...(dryRun
    ? ["--dry-run", "--outdir", resolve(serverDir, `../dry-run-${scriptName}`)]
    : []),
]);

// --- 5. Secrets ---------------------------------------------------------------

if (dryRun) {
  console.log(
    `\nDry run: would set ${Object.keys(secrets).join(", ")} on ${scriptName}.`,
  );
} else {
  const secretsPath = namespace
    ? `/workers/dispatch/namespaces/${namespace}/scripts/${scriptName}/secrets`
    : `/workers/scripts/${scriptName}/secrets`;
  for (const [name, text] of Object.entries(secrets)) {
    await cf("PUT", secretsPath, { name, text, type: "secret_text" });
    console.log(`  secret set: ${name}`);
  }
}

console.log(
  namespace
    ? `\nDeployed ${scriptName} into namespace "${namespace}". Route a hostname to it from your dispatch worker.`
    : `\nDeployed ${scriptName} (${environment}). It answers at ${origin}.`,
);
