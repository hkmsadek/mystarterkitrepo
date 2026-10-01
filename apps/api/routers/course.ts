import { course, enrollment } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../lib/trpc.js";

// Public catalogue reads go through `dbCached`: the same query for every
// visitor, and a course appearing one cache window late is acceptable.
// Enrolment reads and writes stay on `db`: a student must see their own
// enrolment the moment it exists.
export const courseRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.dbCached
      .select({
        id: course.id,
        slug: course.slug,
        title: course.title,
        summary: course.summary,
        priceCents: course.priceCents,
        level: course.level,
      })
      .from(course)
      .where(eq(course.published, true))
      .orderBy(desc(course.createdAt)),
  ),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.dbCached.query.course.findFirst({
        where: (c, { and, eq }) =>
          and(eq(c.slug, input.slug), eq(c.published, true)),
        with: { lessons: { orderBy: (l) => asc(l.position) } },
      });

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      }
      return row;
    }),

  enroll: protectedProcedure
    .input(z.object({ courseId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const found = await ctx.db.query.course.findFirst({
        columns: { id: true },
        where: (c, { and, eq }) =>
          and(eq(c.id, input.courseId), eq(c.published, true)),
      });
      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Course not found" });
      }

      // Enrolling twice is a no-op, not an error: the button may be clicked
      // again after a slow response.
      await ctx.db
        .insert(enrollment)
        .values({ userId: ctx.user.id, courseId: input.courseId })
        .onConflictDoNothing();

      return { courseId: input.courseId };
    }),

  myEnrollments: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.enrollment.findMany({
      where: (e, { eq }) => eq(e.userId, ctx.user.id),
      orderBy: (e, { desc }) => desc(e.createdAt),
      with: {
        course: {
          columns: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            level: true,
          },
          with: { lessons: { columns: { id: true } } },
        },
      },
    });

    return rows.map((e) => ({
      courseId: e.course.id,
      slug: e.course.slug,
      title: e.course.title,
      summary: e.course.summary,
      level: e.course.level,
      lessonCount: e.course.lessons.length,
      enrolledAt: e.createdAt,
    }));
  }),
});
