import type { Database } from "../index";
import { course, lesson, type NewLesson } from "../schema";

type SeedCourse = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  priceCents: number;
  level: string;
  lessons: { title: string; durationMinutes: number; preview?: boolean }[];
};

const courses: SeedCourse[] = [
  {
    slug: "cloudflare-workers-from-zero",
    title: "Cloudflare Workers from zero",
    summary: "Ship a full-stack app on the edge in a weekend.",
    description:
      "Workers are not Node. This course starts from that fact and builds up: the request model, bindings, static assets, and how a database fits in through Hyperdrive.\n\nBy the end you deploy the app you built, with a custom domain and a real database, from a single command.",
    priceCents: 4900,
    level: "Beginner",
    lessons: [
      {
        title: "What a Worker is, and is not",
        durationMinutes: 12,
        preview: true,
      },
      { title: "Your first fetch handler", durationMinutes: 18 },
      { title: "Bindings: assets, KV, Hyperdrive", durationMinutes: 25 },
      { title: "Deploying with Wrangler and CI", durationMinutes: 20 },
    ],
  },
  {
    slug: "astro-for-dynamic-sites",
    title: "Astro for dynamic sites",
    summary: "Prerender what you can, render the rest on request.",
    description:
      "Astro is often sold as a static site tool. It is also a fine server framework. This course draws the line between the two for a content-heavy product and shows how both run in one worker.\n\nYou build a blog and a catalogue backed by Postgres, with caching that keeps the database out of the hot path.",
    priceCents: 0,
    level: "Intermediate",
    lessons: [
      {
        title: "Static versus on-demand, decided per page",
        durationMinutes: 15,
        preview: true,
      },
      { title: "Fetching from an API in frontmatter", durationMinutes: 22 },
      { title: "Islands for the interactive parts", durationMinutes: 19 },
    ],
  },
  {
    slug: "multi-tenant-saas-on-workers-for-platforms",
    title: "Multi-tenant SaaS on Workers for Platforms",
    summary: "One codebase, thousands of isolated customer deployments.",
    description:
      "Every customer gets their own worker, their own database, their own domain, and none of your credentials. This course builds the control plane that makes that true: dispatch namespaces, per-customer Hyperdrive, and a deploy pipeline driven by git.\n\nThe final project deploys a customer's repo on push and routes a wildcard hostname to it.",
    priceCents: 12900,
    level: "Advanced",
    lessons: [
      {
        title: "Dispatch namespaces and the gateway worker",
        durationMinutes: 24,
        preview: true,
      },
      {
        title: "Per-customer databases through Hyperdrive",
        durationMinutes: 21,
      },
      { title: "Secrets, limits, and tags per script", durationMinutes: 17 },
      { title: "Push-to-deploy with a GitHub App", durationMinutes: 28 },
      { title: "Custom domains with Cloudflare for SaaS", durationMinutes: 16 },
    ],
  },
];

/** Seeds the public course catalogue with its lesson outlines. */
export async function seedCourses(db: Database) {
  console.log("Seeding courses...");

  for (const { lessons, ...c } of courses) {
    const [row] = await db
      .insert(course)
      .values({ ...c, published: true })
      .onConflictDoNothing()
      .returning({ id: course.id });

    // Already seeded: `onConflictDoNothing` returns no row, and the lessons
    // below would collide on (courseId, position) anyway.
    if (!row) continue;

    const outline: NewLesson[] = lessons.map((l, i) => ({
      ...l,
      courseId: row.id,
      position: i + 1,
    }));
    await db.insert(lesson).values(outline);
  }

  console.log(`✅ Seeded ${courses.length} courses`);
}
