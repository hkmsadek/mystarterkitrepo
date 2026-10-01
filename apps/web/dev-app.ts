/**
 * @file Hosts the SPA inside the Astro dev server.
 *
 * Production is one worker, so the site, the app and the API share an origin.
 * Development would otherwise be three servers on three ports, and a marketing
 * page's link to /login would land on a server with no such page. This Vite
 * plugin embeds the app's own Vite configuration as middleware in the Astro
 * dev server, so one process on one port serves everything:
 *
 *   /_app/*     the app's modules, assets and hot-reload socket (its dev base)
 *   APP_PATHS   the app shell, as the worker serves it in production
 *   /api/*      forwarded to the API dev server by `worker.ts`
 *   the rest    Astro
 *
 * Both Vite instances attach their hot-reload WebSocket to the same HTTP
 * server; they are told apart by path, Astro's at `/` and the app's at
 * `/_app/`.
 */

import { fileURLToPath } from "node:url";

import { APP_PATHS } from "@repo/core/app-paths";
import { createServer, type Plugin } from "vite";

const APP_ROOT = fileURLToPath(new URL("../app/", import.meta.url));
const appPaths = new Set<string>(APP_PATHS);

export function devApp(): Plugin {
  return {
    name: "dev-app",
    apply: "serve",
    enforce: "pre",

    async configureServer(server) {
      if (!server.httpServer) return;

      const app = await createServer({
        configFile: `${APP_ROOT}vite.config.ts`,
        root: APP_ROOT,
        server: {
          middlewareMode: true,
          // Share Astro's listener; the app's socket path is its base, /_app/.
          hmr: { server: server.httpServer },
        },
      });

      server.httpServer.once("close", () => void app.close());

      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "/").split("?")[0];
        const segment = pathname.split("/")[1] ?? "";
        if (segment === "_app") return app.middlewares(req, res, next);
        if (appPaths.has(segment)) {
          // The shell: Vite serves the app's index.html at its base and
          // injects its client, as it would for any request under /_app/.
          req.url = "/_app/";
          return app.middlewares(req, res, next);
        }
        next();
      });
    },
  };
}
