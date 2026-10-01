/**
 * @file Edge cache for public on-demand pages.
 *
 * A page rendered on request costs a round trip to Postgres, a few hundred
 * milliseconds from a visitor far from the database. The pages that pay it –
 * the blog and the course catalogue – are identical for every visitor, so the
 * rendered HTML is stored in the data centre's cache and served from there
 * until it expires, which brings a repeat visit down to static-file speed.
 *
 * Only responses that opt in are stored: `Cache-Control: public` with a
 * max-age, which the blog and course pages set. Anything personalised must
 * not set that header. Prerendered pages never reach this middleware in
 * production; Cloudflare serves them as files.
 *
 * The cache is per data centre and expires on its own. Purging on publish
 * (so an edit shows immediately rather than within `max-age`) needs the site
 * on a custom domain; the Cache API is also unavailable on workers.dev, where
 * this is a harmless no-op.
 */

import { defineMiddleware } from "astro:middleware";

const CACHE_HEADER = "x-edge-cache";

export const onRequest = defineMiddleware(async (context, next) => {
  // Cloudflare's `caches.default` is not in the DOM typings Astro checks with.
  const cache = (
    globalThis.caches as (CacheStorage & { default?: Cache }) | undefined
  )?.default;
  if (!cache || context.request.method !== "GET") return next();

  // Keyed on the URL alone: the page is public, so a cookie must not split
  // the cache or leak into it.
  const key = new Request(context.url.toString(), { method: "GET" });

  // Best effort: a cache that cannot be read or written must never turn
  // into an error page. Some deployments restrict the Cache API (it is a
  // no-op on workers.dev and unavailable to some dispatched scripts).
  let hit: Response | undefined;
  try {
    hit = await cache.match(key);
  } catch (error) {
    console.warn("edge cache read failed", error);
  }
  if (hit) {
    const response = new Response(hit.body, hit);
    response.headers.set(CACHE_HEADER, "hit");
    return response;
  }

  const response = await next();
  const cacheControl = response.headers.get("cache-control") ?? "";
  const cacheable =
    response.ok &&
    /\bpublic\b/.test(cacheControl) &&
    /max-age=[1-9]/.test(cacheControl);
  if (!cacheable) return response;

  const stored = new Response(response.clone().body, response);
  stored.headers.delete("set-cookie");
  // `s-maxage` tells the edge how long to keep it; browsers keep `max-age`.
  stored.headers.set(
    "cache-control",
    `${cacheControl}, s-maxage=300, stale-while-revalidate=60`,
  );

  const put = cache.put(key, stored).catch((error: unknown) => {
    console.warn("edge cache write failed", error);
  });
  context.locals.cfContext?.waitUntil(put);

  response.headers.set(CACHE_HEADER, "miss");
  return response;
});
