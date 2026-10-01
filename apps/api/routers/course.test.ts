import { course, lesson } from "@repo/db";
import { createTestDatabase } from "@repo/db/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { TRPCContext } from "../lib/context";
import { createCallerFactory } from "../lib/trpc";
import { courseRouter } from "./course";

const createCaller = createCallerFactory(courseRouter);

const { db, reset, close } = await createTestDatabase();

afterAll(close);
beforeEach(reset);

const caller = createCaller({
  req: new Request("http://localhost"),
  info: {} as TRPCContext["info"],
  session: null,
  user: null,
  db,
  dbCached: db,
  env: {} as TRPCContext["env"],
});

async function insertCourse(slug: string, published: boolean) {
  const [row] = await db
    .insert(course)
    .values({
      slug,
      title: slug,
      summary: "s",
      description: "d",
      level: "Beginner",
      published,
    })
    .returning({ id: course.id });
  return row.id;
}

describe("course", () => {
  it("lists only published courses", async () => {
    await insertCourse("live", true);
    await insertCourse("draft", false);

    expect((await caller.list()).map((c) => c.slug)).toEqual(["live"]);
    await expect(caller.bySlug({ slug: "draft" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns lessons in outline order", async () => {
    const id = await insertCourse("live", true);
    await db.insert(lesson).values([
      { courseId: id, position: 2, title: "Second", durationMinutes: 5 },
      {
        courseId: id,
        position: 1,
        title: "First",
        durationMinutes: 5,
        preview: true,
      },
    ]);

    const found = await caller.bySlug({ slug: "live" });
    expect(found.lessons.map((l) => l.title)).toEqual(["First", "Second"]);
    expect(found.lessons[0].preview).toBe(true);
  });
});
