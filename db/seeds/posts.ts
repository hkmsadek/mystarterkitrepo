import type { Database } from "../index";
import { type NewPost, post } from "../schema";

/** Seeds the blog with published posts so the site has content on first run. */
export async function seedPosts(db: Database) {
  console.log("Seeding posts...");

  const posts: NewPost[] = [
    {
      slug: "why-you-wake-at-3am",
      title: "Why you wake at 3 a.m., and what not to do about it",
      excerpt:
        "The middle-of-the-night wake-up is common, explainable, and made worse by the obvious fixes.",
      content:
        "Most adults wake briefly several times a night. The difference between a good sleeper and a bad one is not whether they wake, it is what happens next. A good sleeper rolls over. A bad sleeper checks the time, does the arithmetic on how many hours are left, and starts a meeting with themselves.\n\nThe arithmetic is the problem. It turns a normal wake-up into a threat, and threat is wakefulness. So the first change is boring: cover the clock. The second is stranger: if you are awake for more than about twenty minutes, get up, sit somewhere dim, and do something dull until you are sleepy. Lying there trying is practice at lying there trying.\n\nThe Sleep Reset programme builds this into two weeks of small changes. None of them are dramatic. All of them are kept.",
      published: true,
      publishedAt: new Date("2026-09-02T09:00:00Z"),
    },
    {
      slug: "worry-is-not-planning",
      title: "Worry is not planning",
      excerpt:
        "They feel similar from the inside. One produces a next step, the other produces more of itself.",
      content:
        "Planning answers a question: what will I do? Worry asks a question and refuses the answer: but what if? You can tell them apart by what you have at the end. Planning leaves you with a list, or a decision, or a phone call to make tomorrow. Worry leaves you with the same question and a tighter chest.\n\nA useful habit is to interrupt a worry loop with one written line: the next concrete action, or the word none. If there is an action, you have planned, and you can stop. If there is none, you have learned the loop was not useful, and you can practise letting it run in the background instead of the foreground.\n\nThat practice is the heart of the Working with Worry programme. It does not promise fewer worries. It promises they take up less room.",
      published: true,
      publishedAt: new Date("2026-09-09T09:00:00Z"),
    },
    {
      slug: "the-sunday-dread",
      title: "The Sunday dread",
      excerpt:
        "A low Sunday is not a verdict on your job. It is usually a verdict on your weekend.",
      content:
        "The feeling arrives around four on a Sunday afternoon. Nothing has happened yet. That is the point: it is anticipation, and anticipation is shaped by two things, how the last week ended and how this weekend went.\n\nIf Friday ended with an open loop, close it on Friday. Ten minutes writing down what Monday starts with removes the vague shape that dread needs. If the weekend was recovery only, no plans, no people, no movement, the dread is partly your body noticing it did not actually rest. Rest is not the absence of effort. It is a different kind.\n\nIn the Stress at Work programme we spend a whole week on the edges of the week, because that is where most of the stress lives.",
      published: true,
      publishedAt: new Date("2026-09-16T09:00:00Z"),
    },
    {
      slug: "burnout-is-not-tiredness",
      title: "Burnout is not tiredness",
      excerpt:
        "Tired people recover with rest. Burnt-out people often cannot, and that is the diagnostic clue.",
      content:
        "Tiredness responds to sleep. Burnout does not, or not much. The signature is a flattening: things that used to matter stop mattering, and the response to a holiday is relief at being away rather than any return of interest.\n\nThe mistake is to treat it as a quantity problem and push harder on rest. It is closer to a meaning problem. Recovery involves restoring the link between what you do and anything you care about, which usually means doing less of some things and more of a very small number of others, deliberately.\n\nCoaching helps here because the work is mostly deciding, and deciding alone while depleted is slow. The Running on Empty programme is built around those decisions.",
      published: true,
      publishedAt: new Date("2026-09-23T09:00:00Z"),
    },
    {
      slug: "what-a-coach-is-for",
      title: "What a coach is for, and what a coach is not for",
      excerpt:
        "Coaching is structured help with a plan. It is not therapy, and it should say so.",
      content:
        "A coach helps you pick something to work on, keeps the pace honest, and asks the questions you would skip on your own. That is the whole job, and it is a good job. It is not treatment. A coach does not diagnose, does not work with trauma, and does not replace a clinician when one is needed.\n\nThe mark of a good coach is how quickly they say so. If a programme is not the right level of help, the useful thing is a referral, not a longer programme. Every SteadyMind coach works to that rule, and every programme page says it plainly.\n\nIf you are reading this in a bad moment, please reach a crisis line or emergency services. The programmes will still be here.",
      published: true,
      publishedAt: new Date("2026-09-27T09:00:00Z"),
    },
    {
      slug: "draft-october-letter",
      title: "October letter (draft)",
      excerpt: "Not published yet.",
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
