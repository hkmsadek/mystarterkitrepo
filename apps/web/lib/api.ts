import type { AppRouter } from "@repo/api";
import apiWorker from "@repo/api/worker";
import { createTRPCClient, httpLink } from "@trpc/client";
import { env } from "cloudflare:workers";

/**
 * A tRPC client for on-demand pages, sharing the API's router types.
 *
 * Production: the API lives in this same worker, so calls are dispatched to
 * its Hono app in-process – no network, no service binding – addressed by the
 * public origin so cookies and redirects line up.
 * Development: `astro dev` runs in workerd but the API's bindings are not
 * configured there, so the client uses the API dev server over HTTP.
 */
export function api(request: Request, ctx: ExecutionContext) {
  if (import.meta.env.DEV) {
    return createTRPCClient<AppRouter>({
      links: [httpLink({ url: `${import.meta.env.API_ORIGIN}/api/trpc` })],
    });
  }

  const origin = new URL(request.url).origin;
  return createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: `${origin}/api/trpc`,
        fetch: async (input, init) =>
          apiWorker.fetch(new Request(input, init as RequestInit), env, ctx),
      }),
    ],
  });
}
