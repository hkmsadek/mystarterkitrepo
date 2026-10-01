import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

// Astro does not expose the root .env to this config file, so load it explicitly.
const env = loadEnv(process.env.NODE_ENV || "development", "../..", "");

// `astro dev` runs the worker in workerd with the `dev` Wrangler environment,
// whose secrets Wrangler reads from the process. Hand it the root .env values
// so the in-worker API can reach the database without a second config file.
if (process.argv.includes("dev")) {
  process.env.CLOUDFLARE_ENV ??= "dev";
  for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "RESEND_API_KEY"]) {
    if (env[key]) process.env[key] ??= env[key];
  }
}

export default defineConfig({
  // The edge worker serves marketing, app, and API routes on one public origin.
  site: env.APP_ORIGIN,
  srcDir: ".",
  publicDir: "./public",
  outDir: "./dist",
  // Static by default; a page opts into on-demand rendering with
  // `export const prerender = false` (see `pages/blog/`). The adapter runs
  // `worker.ts` as the Worker entry, in workerd, for dev and production alike.
  output: "static",
  // Links are fetched when hovered, so a click on an on-demand page is served
  // from the browser's cache rather than waiting on the worker and database.
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // No Astro sessions (Better Auth owns sessions in the API) and no image
  // transforms, so the adapter provisions neither a KV namespace nor an
  // Images binding on deploy.
  adapter: cloudflare({
    configPath: "./wrangler.jsonc",
    imageService: "passthrough",
  }),
  session: false,
  integrations: [react()],
  vite: {
    // Astro recommends Tailwind v4's dedicated Vite plugin.
    plugins: [tailwindcss()],
    define: {
      // Where on-demand pages reach the API when no service binding is
      // attached, i.e. under `astro dev`. Production uses the binding.
      "import.meta.env.API_ORIGIN": JSON.stringify(
        env.API_ORIGIN || "http://localhost:8787",
      ),
    },
  },
});
