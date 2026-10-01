import { course } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../lib/trpc.js";

// Public catalogue reads go through `dbCached`: the same query for every
// visitor, and a course appearing one cache window late is acceptable.
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
});
