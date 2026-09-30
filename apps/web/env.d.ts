/// <reference types="@astrojs/cloudflare/types.d.ts" />

/**
 * Bindings declared in `wrangler.jsonc`. Written by hand rather than generated
 * (`wrangler types`) so the contract is reviewed like any other code and does
 * not narrow placeholder vars to literals.
 *
 * The API runs inside this worker, so its environment contract (vars and
 * secrets, `apps/api/lib/env.ts`) and its Hyperdrive bindings are part of it.
 */
type ApiEnv = import("@repo/api").Env;

interface Env extends ApiEnv {
  /** Prerendered pages, static files, and the SPA build under `/_app/`. */
  ASSETS: Fetcher;
  HYPERDRIVE_CACHED: Hyperdrive;
  HYPERDRIVE_UNCACHED: Hyperdrive;
}

declare namespace Cloudflare {
  interface Env extends globalThis.Env {}
}

interface ImportMetaEnv {
  /** Injected by `vite.define` in `astro.config.mjs`. */
  readonly API_ORIGIN: string;
}
