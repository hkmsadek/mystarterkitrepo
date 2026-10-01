/**
 * The one deployable worker: marketing site, app, and API in a single script.
 *
 * - `/api/*` and `/health` go to the API (`@repo/api/worker`, Hono + tRPC +
 *   Better Auth), dispatched in-process – no network hop.
 * - App routes (`APP_PATHS` from `@repo/core/app-paths`) serve the SPA shell
 *   from ASSETS; the app's build is copied under `_app/` by
 *   `scripts/bundle-app.ts`.
 * - "/" is the marketing home for everyone; the app's dashboard is `/dashboard`.
 * - Everything else is Astro: prerendered pages and static files from ASSETS,
 *   on-demand pages (`export const prerender = false`) rendered here.
 *
 * One worker is what a Workers for Platforms dispatch namespace accepts, so
 * this is also the shape a customer's customised copy deploys in.
 */

import { handle as astro } from "@astrojs/cloudflare/handler";
import api from "@repo/api/worker";
import { APP_PATHS } from "@repo/core/app-paths";
import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

// API, dispatched to the API's own Hono app so its middleware and per-request
// context (database, auth) run exactly as they would in a separate worker.
//
// Under `astro dev` the worker runs in a dev sandbox whose outbound sockets
// cannot reach Postgres, so the API dev server (`bun api:dev`) answers instead.
const toApi = import.meta.env.DEV
  ? (c: { req: { raw: Request } }) => {
      const url = new URL(c.req.raw.url);
      const target = new URL(
        url.pathname + url.search,
        import.meta.env.API_ORIGIN,
      );
      // The API dev server trusts the origin named here (cookies, Better Auth
      // trusted origins, redirects), the same contract as the SPA's Vite proxy.
      // The browser's own Origin header is the one value that survives a
      // TLS-terminating sandbox or tunnel proxy intact; without it (plain GET)
      // the API falls back to its configured APP_ORIGIN.
      const headers = new Headers(c.req.raw.headers);
      const origin = c.req.raw.headers.get("origin");
      if (origin) headers.set("x-forwarded-origin", origin);
      return fetch(
        new Request(target, {
          method: c.req.raw.method,
          headers,
          body: c.req.raw.body,
          redirect: "manual",
        }),
      );
    }
  : (c: { req: { raw: Request }; env: Env; executionCtx: unknown }) =>
      api.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext);
app.all("/api/*", toApi);
app.get("/health", toApi);

// The SPA shell (`apps/app/dist/index.html`, copied to `_app/index.html`);
// the router takes over in the browser.
function spaShell(c: { req: { raw: Request }; env: Env }) {
  const shell = new URL("/_app/", c.req.raw.url);
  return c.env.ASSETS.fetch(new Request(shell, { headers: c.req.raw.headers }));
}

// SPA routes: a real file under the app's build wins (`/_app/assets/...`);
// any other app path gets the shell.
async function spa(c: { req: { raw: Request }; env: Env }) {
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) return asset;
  return spaShell(c);
}

// Match each exact path and its slash-delimited children. A bare `/${path}*`
// also matches shared prefixes such as `/members-only`, which would shadow a
// marketing page at that path with the SPA shell.
for (const path of APP_PATHS) {
  app.all(`/${path}`, spa);
  app.all(`/${path}/*`, spa);
}

// Astro: static files, prerendered pages and on-demand pages. This is the
// adapter's own request handler rather than the `astro/hono` pieces, because
// those resolve routes the production way (prerendered pages are assets) and
// so cannot render a prerendered page under `astro dev`; the handler matches
// routes dev-aware and serves assets identically in production.
//
// Hono types `executionCtx` with its own minimal `ExecutionContext`; the
// adapter wants the Workers one. Same object at runtime, hence the assertion.
app.all("*", (c) =>
  astro(c.req.raw, c.env, c.executionCtx as ExecutionContext),
);

export default app;
