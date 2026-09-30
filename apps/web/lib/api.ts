import type { AppRouter } from "@repo/api";
import { createTRPCClient, httpLink } from "@trpc/client";
import { env } from "cloudflare:workers";

/**
 * A tRPC client for on-demand pages, sharing the API's router types.
 *
 * Production: calls go over the `API_SERVICE` binding, an internal hop inside
 * Cloudflare, addressed by the public origin so cookies and redirects line up.
 * Development: `astro dev` runs in workerd and attaches a stub for every
 * declared service binding that answers "worker not running", so the client
 * ignores bindings there and uses the API dev server over HTTP instead.
 */
export function api(request: Request) {
  const binding = import.meta.env.DEV ? undefined : env.API_SERVICE;
  const origin = binding
    ? new URL(request.url).origin
    : import.meta.env.API_ORIGIN;

  return createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: `${origin}/api/trpc`,
        fetch: binding
          ? (input, init) => binding.fetch(new Request(input, init))
          : undefined,
      }),
    ],
  });
}
