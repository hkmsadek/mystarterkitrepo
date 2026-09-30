import type { Database } from "../index";
import { type NewPost, post } from "../schema";

/** Seeds a few published posts so the blog has content on first run. */
export async function seedPosts(db: Database) {
  console.log("Seeding posts...");

  const posts: NewPost[] = [
    {
      slug: "hello-world",
      title: "Hello, world",
      excerpt: "The first post, rendered on request from Postgres.",
      content:
        "This page is not a static file. The marketing worker asked the API for this post when you requested it, and the API read it from Postgres through Hyperdrive.\n\nEdit or add posts from the app, then reload. No rebuild, no redeploy.",
      published: true,
      publishedAt: new Date("2026-09-01T09:00:00Z"),
    },
    {
      slug: "why-three-workers",
      title: "Why three workers",
      excerpt: "Marketing, app, and API each get the runtime they need.",
      content:
        "The marketing site prerenders what it can and renders the rest on request. The app is a static SPA. The API runs with Node compatibility for the database driver and auth.\n\nOne repo, one deploy command, three workers behind one hostname.",
      published: true,
      publishedAt: new Date("2026-09-10T09:00:00Z"),
    },
    {
      slug: "one-repo-one-deploy",
      title: "One repo, one deploy command",
      excerpt: "Three workers in the dashboard does not mean three projects.",
      content:
        "The marketing site, the app and the API live in one repository and share one lockfile, one set of UI components and one database schema. A change to an API procedure and the page that calls it land in the same commit.\n\nOne command builds everything and deploys the workers in dependency order: API first, then the app, then the web worker that fronts them both. Visitors only ever talk to the last one.",
      published: true,
      publishedAt: new Date("2026-09-14T09:00:00Z"),
    },
    {
      slug: "prerender-or-render-on-request",
      title: "Prerender, or render on request?",
      excerpt: "A simple rule for deciding which pages need a server.",
      content:
        "Prerender anything that changes only when you deploy: the home page, pricing, feature tours. It is built once and served from the edge cache for free.\n\nRender on request anything that changes when your data changes: this blog, a public course page, a user's profile. The page runs in the worker, asks the API, and returns fresh HTML with a short cache header.\n\nKeep everything behind a login as a client app. Search engines never see it and it has more state than HTML wants to carry.",
      published: true,
      publishedAt: new Date("2026-09-18T09:00:00Z"),
    },
    {
      slug: "sandboxes-that-sleep",
      title: "Sandboxes that sleep",
      excerpt: "Why active-CPU billing fits interactive coding sessions.",
      content:
        "An interactive coding session is idle most of the time. The user reads, thinks, types; the CPU spikes only when a build runs or a page reloads.\n\nBilling that charges for wall-clock time makes you pay for the thinking. Billing that charges for active CPU, with memory provisioned only while the sandbox is awake, makes an hour of mostly idle editing cost less than a coffee.\n\nThe corollary: let sandboxes sleep aggressively, and make waking them fast.",
      published: true,
      publishedAt: new Date("2026-09-22T09:00:00Z"),
    },
    {
      slug: "drafts-stay-private",
      title: "Drafts stay private",
      excerpt: "The published flag is enforced by the API, not the page.",
      content:
        "The blog pages never filter posts themselves. They ask the API for published posts, and the API applies the filter in the query.\n\nThat is deliberate. A filter in the page is a filter someone can forget when they add a second page. A filter in the API protects every caller, including ones that do not exist yet.",
      published: true,
      publishedAt: new Date("2026-09-26T09:00:00Z"),
    },
    {
      slug: "draft-post",
      title: "A draft nobody should see",
      excerpt: "Unpublished posts never leave the API.",
      content:
        "If you can read this on the public site, the published filter is broken.",
      published: false,
    },
  ];

  for (const p of posts) {
    await db.insert(post).values(p).onConflictDoNothing();
  }

  console.log(`✅ Seeded ${posts.length} posts`);
}
