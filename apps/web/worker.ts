/**
 * Edge router for the marketing site.
 *
 * Routes "/" based on auth-hint cookie presence:
 * - Cookie present: proxy to app (session validated there)
 * - No cookie: serve marketing site
 *
 * Everything the router does not claim falls through to Astro: prerendered
 * pages and static files come from the ASSETS binding, on-demand pages
 * (`export const prerender = false`) render here in the worker.
 *
 * See docs/adr/001-auth-hint-cookie.md
 */

import { handle as astro } from "@astrojs/cloudflare/handler";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";

/**
 * Paths forwarded to the app worker.
 *
 * Keep route entries in sync with the app-owned top-level routes under
 * `apps/app/routes/`. Missing entries fall through to the marketing site on a
 * direct request, even though client-side navigation still works.
 *
 * `/` is handled below using the auth hint. Everything under `apps/web/pages/`
 * is marketing-owned and must not appear here. `apps/app/lib/edge-routing.test.ts`
 * checks both directions.
 */
const APP_PATHS = [
  "_app", // Vite build output (JS, CSS, assets)
  "login",
  "members",
  "posts",
  "settings",
  "signup",
  "todos",
] as const;

const app = new Hono<{ Bindings: Env }>();

// Service bindings are absent under `astro dev`: the SPA dev server proxies
// `/api` itself, and the marketing pages reach the API over HTTP (`lib/api.ts`).
function proxy(service: Fetcher | undefined, request: Request) {
  if (!service) {
    return new Response("Service binding not attached in this environment", {
      status: 503,
    });
  }
  return service.fetch(request);
}

// API proxy
app.all("/api/*", (c) => proxy(c.env.API_SERVICE, c.req.raw));

// Match each exact path and its slash-delimited children. A bare `/${path}*`
// also matches shared prefixes such as `/members-only`; the app worker's SPA
// fallback would then shadow a marketing page at that path.
for (const path of APP_PATHS) {
  app.all(`/${path}`, (c) => proxy(c.env.APP_SERVICE, c.req.raw));
  app.all(`/${path}/*`, (c) => proxy(c.env.APP_SERVICE, c.req.raw));
}

// Home page: route based on auth-hint cookie presence
// __Host-auth (HTTPS) or auth (HTTP dev) – see docs/adr/001-auth-hint-cookie.md
app.on(["GET", "HEAD"], "/", async (c, next) => {
  const hasAuthHint =
    getCookie(c, "__Host-auth") === "1" || getCookie(c, "auth") === "1";

  if (hasAuthHint) {
    const upstream = await proxy(c.env.APP_SERVICE, c.req.raw);
    return withPrivateCache(upstream);
  }

  // Marketing home, served by Astro below.
  await next();
  c.res = withPrivateCache(c.res);
});

// Prevent caching – the response at "/" varies by auth state.
function withPrivateCache(upstream: Response) {
  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Cookie");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
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
