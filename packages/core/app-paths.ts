/**
 * Top-level URL paths owned by the SPA.
 *
 * Shared by the production worker (`apps/web/worker.ts`), which serves the
 * app shell for them, and the Astro dev server (`apps/web/dev-app.ts`), which
 * hands them to the embedded app Vite instance. Keep it in sync with the app-owned top-level routes
 * under `apps/app/routes/`: a missing entry falls through to the marketing
 * site and 404s on direct load, even though client-side navigation still
 * works. Everything under `apps/web/pages/` is marketing-owned and must not
 * appear here. `apps/app/lib/edge-routing.test.ts` checks both directions.
 */
export const APP_PATHS = [
  "_app", // Vite build output (JS, CSS, assets)
  "dashboard",
  "login",
  "members",
  "posts",
  "settings",
  "signup",
  "todos",
] as const;

/** Whether a URL pathname's first segment belongs to the SPA. */
export function isAppPath(pathname: string): boolean {
  const segment = pathname.split("/")[1] ?? "";
  return (APP_PATHS as readonly string[]).includes(segment);
}
