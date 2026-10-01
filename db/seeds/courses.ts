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
    slug: "sleep-reset",
    title: "Sleep Reset",
    summary: "Two weeks to a steadier night, without trying harder to sleep.",
    description:
      "Bad sleep rarely has one cause, but it almost always has one engine: effort. The harder you try, the worse it gets. This programme removes the effort and replaces it with a small number of fixed habits that your body can rely on.\n\nFourteen short lessons, one a day. Each ends with a single change to keep. By the end you will have a wind-down you do not have to think about, a plan for the 3 a.m. wake-up, and a clear picture of what actually moves your sleep.\n\nFree, because it is the programme most people need first.",
    priceCents: 0,
    level: "Start here",
    lessons: [
      {
        title: "Why trying to sleep backfires",
        durationMinutes: 9,
        preview: true,
      },
      { title: "Fixing the wake time, not the bedtime", durationMinutes: 11 },
      {
        title: "Light, caffeine, and the afternoon cliff",
        durationMinutes: 10,
      },
      { title: "The 3 a.m. protocol", durationMinutes: 12 },
      { title: "A wind-down you will keep", durationMinutes: 8 },
      { title: "Week-two review and your sleep plan", durationMinutes: 14 },
    ],
  },
  {
    slug: "working-with-worry",
    title: "Working with Worry",
    summary: "Three weeks of practical tools for anxious thinking.",
    description:
      "Worry is a habit of mind, which is good news: habits can be worked with. This programme teaches the three skills that make the biggest difference: telling worry apart from planning, letting a worry run without feeding it, and taking action on the small number that deserve it.\n\nThe tools come from cognitive behavioural coaching and acceptance-based practice. Expect short daily exercises, two written reviews, and a plan for the situations that set you off most.",
    priceCents: 4900,
    level: "Core",
    lessons: [
      { title: "Worry versus planning", durationMinutes: 10, preview: true },
      { title: "The next concrete action", durationMinutes: 12 },
      { title: "Letting a thought be a thought", durationMinutes: 15 },
      { title: "Scheduled worry time", durationMinutes: 11 },
      { title: "Your trigger map", durationMinutes: 16 },
      { title: "Keeping the gains", durationMinutes: 12 },
    ],
  },
  {
    slug: "stress-at-work",
    title: "Stress at Work",
    summary:
      "Four weeks on the edges of the week: Mondays, Fridays, and the hours after.",
    description:
      "Most work stress is not the work. It is the open loops, the unclear asks, and the evenings that never quite start. This programme works on those edges first, then on the conversations that keep them from coming back.\n\nYou will build a Friday shutdown, a Monday start, and a way of saying what you can and cannot take on that your manager can actually hear.",
    priceCents: 6900,
    level: "Core",
    lessons: [
      {
        title: "Where the stress actually lives",
        durationMinutes: 12,
        preview: true,
      },
      { title: "The Friday shutdown", durationMinutes: 14 },
      { title: "The Monday start", durationMinutes: 10 },
      { title: "Evenings that begin", durationMinutes: 11 },
      { title: "Saying no in a way that lands", durationMinutes: 18 },
      { title: "Asking for what you need", durationMinutes: 16 },
      { title: "Your four-week plan", durationMinutes: 13 },
    ],
  },
  {
    slug: "running-on-empty",
    title: "Running on Empty",
    summary: "Burnout recovery for people who cannot take three months off.",
    description:
      "Burnout does not respond to rest alone. It responds to restoring the link between what you do and what you care about, and that is a series of decisions, not a holiday. This programme walks through those decisions with a coach-style structure: what to stop, what to protect, and what to do with the first energy that comes back.\n\nBest taken with one-to-one sessions, because deciding while depleted is slow and lonely. Works alone too.",
    priceCents: 9900,
    level: "Intensive",
    lessons: [
      { title: "Tired or burnt out?", durationMinutes: 11, preview: true },
      { title: "The stop list", durationMinutes: 15 },
      { title: "Protecting one thing", durationMinutes: 13 },
      { title: "Rest that restores", durationMinutes: 12 },
      { title: "First energy back: what to spend it on", durationMinutes: 14 },
      { title: "Talking to the people it affects", durationMinutes: 17 },
      { title: "Your recovery plan", durationMinutes: 15 },
    ],
  },
];

/** Seeds the programme catalogue with its lesson outlines. */
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
