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
