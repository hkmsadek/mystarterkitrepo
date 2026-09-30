/**
 * @file Database client: Postgres via Cloudflare Hyperdrive or a plain URL.
 *
 * Two bindings available: HYPERDRIVE_UNCACHED (always fresh, the default) and
 * HYPERDRIVE_CACHED (served from the cache window Terraform configures).
 *
 * A deployment without Hyperdrive – a customer's copy in a dispatch namespace,
 * whose database is set per script as the `DATABASE_URL` secret – connects
 * with the URL directly. The provider's pooled endpoint then does the work
 * Hyperdrive would have, at the cost of a TCP handshake per request.
 */

import { schema } from "@repo/db";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/** What `worker.ts` resolves from the environment before creating clients. */
export type DatabaseSources = {
  /** Always-fresh connection string. */
  uncached: string;
  /** Cacheable reads; the same string as `uncached` without Hyperdrive. */
  cached: string;
};

/**
 * Picks the connection strings for this deployment: Hyperdrive bindings when
 * bound, `DATABASE_URL` otherwise. Throws when neither is configured, because
 * a worker with no database is a misconfiguration, not a degraded mode.
 */
export function resolveDatabaseSources(env: {
  HYPERDRIVE_CACHED?: Hyperdrive;
  HYPERDRIVE_UNCACHED?: Hyperdrive;
  DATABASE_URL?: string;
}): DatabaseSources {
  const uncached =
    env.HYPERDRIVE_UNCACHED?.connectionString ?? env.DATABASE_URL;
  if (!uncached) {
    throw new Error(
      "No database configured: bind HYPERDRIVE_UNCACHED or set DATABASE_URL.",
    );
  }
  return {
    uncached,
    cached: env.HYPERDRIVE_CACHED?.connectionString ?? uncached,
  };
}

/**
 * Creates a database client using Drizzle ORM.
 *
 * @param connectionString - From a Hyperdrive binding or `DATABASE_URL`
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    // Each request builds two clients (cached + uncached), and Workers caps
    // concurrent external connections. One apiece stays well inside that.
    max: 1,
    connect_timeout: 10,
    // Prepared statements left on (postgres.js default). Hyperdrive only caches
    // queries it sees prepared; `prepare: false` would cost it the cache and an
    // extra round-trip. This is why the origin must be an unpooled host – a
    // transaction-mode pooler in front of Postgres breaks prepared statements.
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    transform: {
      undefined: null,
    },
    onnotice: () => {},
  });

  return drizzle(client, { schema, casing: "snake_case" });
}

export { schema as Db };
