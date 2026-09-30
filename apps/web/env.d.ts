/// <reference types="@astrojs/cloudflare/types.d.ts" />

/**
 * Bindings declared in `wrangler.jsonc`. Written by hand rather than generated
 * (`wrangler types`) so the contract is reviewed like any other code and does
 * not narrow placeholder vars to literals.
 */
interface Env {
  /** Prerendered pages and static files. */
  ASSETS: Fetcher;
  /** SPA worker; absent under `astro dev`. */
  APP_SERVICE?: Fetcher;
  /** API worker; absent under `astro dev`. */
  API_SERVICE?: Fetcher;
}

declare namespace Cloudflare {
  interface Env extends globalThis.Env {}
}

interface ImportMetaEnv {
  /** Injected by `vite.define` in `astro.config.mjs`. */
  readonly API_ORIGIN: string;
}
