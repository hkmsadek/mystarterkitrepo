import { course, lesson, user } from "@repo/db";
import { createTestDatabase } from "@repo/db/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { TRPCContext } from "../lib/context";
import { createCallerFactory } from "../lib/trpc";
import { courseRouter } from "./course";

const createCaller = createCallerFactory(courseRouter);

const { db, reset, close } = await createTestDatabase();

afterAll(close);
beforeEach(reset);

function callerFor(userId: string | null) {
  const ctx: TRPCContext = {
    req: new Request("http://localhost"),
    info: {} as TRPCContext["info"],
    session: userId
      ? {
          id: "ses_test",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId,
          expiresAt: new Date(Date.now() + 60_000),
          token: "token",
        }
      : null,
    user: userId
      ? {
          id: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "student@example.com",
          emailVerified: true,
          name: "Student",
        }
      : null,
    db,
    dbCached: db,
    env: {} as TRPCContext["env"],
  };
  return createCaller(ctx);
}

async function insertUser(email: string) {
  const [row] = await db
    .insert(user)
    .values({ name: "Student", email, emailVerified: true })
    .returning();
  return row.id;
}

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
    const anonymous = callerFor(null);
    await insertCourse("live", true);
    await insertCourse("draft", false);

    expect((await anonymous.list()).map((c) => c.slug)).toEqual(["live"]);
    await expect(anonymous.bySlug({ slug: "draft" })).rejects.toMatchObject({
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

    const found = await callerFor(null).bySlug({ slug: "live" });
    expect(found.lessons.map((l) => l.title)).toEqual(["First", "Second"]);
    expect(found.lessons[0].preview).toBe(true);
  });

  it("enrols a signed-in user once and lists their courses", async () => {
    const student = callerFor(await insertUser("a@example.com"));
    const other = callerFor(await insertUser("b@example.com"));
    const id = await insertCourse("live", true);
    await db
      .insert(lesson)
      .values({ courseId: id, position: 1, title: "Only", durationMinutes: 5 });

    await expect(
      callerFor(null).enroll({ courseId: id }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await student.enroll({ courseId: id });
    await student.enroll({ courseId: id });

    const mine = await student.myEnrollments();
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ slug: "live", lessonCount: 1 });
    expect(await other.myEnrollments()).toEqual([]);
  });

  it("refuses enrolment in an unpublished course", async () => {
    const student = callerFor(await insertUser("a@example.com"));
    const id = await insertCourse("draft", false);
    await expect(student.enroll({ courseId: id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
