#!/usr/bin/env bun

/**
 * @file Deploys one customer's copy of the worker, programmatically.
 *
 * This is the step the platform will run after a customer's build: no login,
 * no dashboard, only an account ID and an API token in the environment. It
 * takes the artifact `bun run build` left in `apps/web/dist` and:
 *
 *   1. finds or creates a Hyperdrive config for the customer's database, so
 *      their worker reaches Postgres through Cloudflare's pool rather than a
 *      fresh TLS handshake per request from wherever the visitor is;
 *   2. writes a per-customer Wrangler config next to the generated one – same
 *      code, their name, their Hyperdrive binding, their origin;
 *   3. uploads it, either into a Workers for Platforms dispatch namespace
 *      (`--namespace`) or as a standalone worker on workers.dev (the default,
 *      handy for testing the flow before a dispatch worker exists);
 *   4. sets the worker's secrets through the REST API.
 *
 * Usage:
 *   bun scripts/deploy-customer.ts --customer acme \
 *     --database-url "postgres://..." \
 *     --origin https://cust-acme.<subdomain>.workers.dev \
 *     [--namespace customers] [--dry-run]
 *
 * Environment:
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN   – the platform's, never the customer's
 *   BETTER_AUTH_SECRET, RESEND_API_KEY            – per customer, or shared defaults
 *
 * `--dry-run` skips every network call, still writes the config, and asks
 * Wrangler to bundle it, so the artifact and config are validated offline.
 */

import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    customer: { type: "string" },
    "database-url": { type: "string" },
    origin: { type: "string" },
    namespace: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const customer = args.customer ?? fail("--customer <id> is required");
if (!/^[a-z0-9-]{1,40}$/.test(customer)) {
  fail("--customer must be lowercase letters, digits and hyphens");
}
const databaseUrl =
  args["database-url"] ?? fail("--database-url <postgres url> is required");
const origin = args.origin ?? fail("--origin <https://host> is required");
const namespace = args.namespace;
const dryRun = args["dry-run"];

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
const scriptName = `cust-${customer}`;

try {
  await access(generatedConfig);
} catch {
  fail(`Missing ${generatedConfig} – run \`bun run build\` first.`);
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

// --- 1. Hyperdrive ------------------------------------------------------------

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
    origin: parseOrigin(databaseUrl),
    caching,
  });
}

console.log(`\nHyperdrive for ${scriptName}`);
const uncached = await ensureHyperdrive(`${scriptName}-uncached`, {
  disabled: true,
});
const cached = await ensureHyperdrive(`${scriptName}-cached`, {
  disabled: false,
});
console.log(`  uncached: ${uncached.id}\n  cached:   ${cached.id}`);

// --- 2. Per-customer config ---------------------------------------------------

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

const config: WranglerConfig = {
  ...base,
  name: scriptName,
  vars: { ...base.vars, APP_ORIGIN: origin },
  hyperdrive: [
    { binding: "HYPERDRIVE_CACHED", id: cached.id },
    { binding: "HYPERDRIVE_UNCACHED", id: uncached.id },
  ],
  // A dispatch script has no workers.dev address; a standalone test worker
  // needs one to be reachable at all.
  workers_dev: !namespace,
};
// Wrangler checks required secrets against the target before uploading, and
// a first deploy has none yet. They are set right after the upload instead.
delete config.secrets;

const configPath = resolve(serverDir, `wrangler.${scriptName}.json`);
await writeFile(configPath, JSON.stringify(config, null, 2));
console.log(`\nConfig written: ${configPath}`);

// --- 3. Upload ----------------------------------------------------------------

const deploy = [
  "bun",
  "wrangler",
  "deploy",
  "--config",
  configPath,
  ...(namespace ? ["--dispatch-namespace", namespace] : []),
  ...(dryRun
    ? ["--dry-run", "--outdir", resolve(serverDir, `dry-run-${scriptName}`)]
    : []),
];

console.log(`\n$ ${deploy.join(" ")}`);
const child = Bun.spawn(deploy, {
  cwd: repoRoot,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env },
});
if ((await child.exited) !== 0) fail("Upload failed.");

// --- 4. Secrets ---------------------------------------------------------------

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
    : `\nDeployed ${scriptName}. It answers at ${origin} once workers.dev DNS settles.`,
);
