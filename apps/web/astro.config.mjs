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

// Prerendering also runs the worker in workerd, and Wrangler refuses to start
// it without a local origin for every Hyperdrive binding. Prerendered pages
// never open a connection, so any well-formed URL will do when the root .env
// does not provide one (CI, or a laptop without a local Postgres).
for (const binding of ["HYPERDRIVE_CACHED", "HYPERDRIVE_UNCACHED"]) {
  const key = `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${binding}`;
  process.env[key] ??=
    env[key] || "postgres://prerender:prerender@localhost:5432/prerender";
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
