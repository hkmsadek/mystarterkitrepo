import { post } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../lib/trpc.js";

const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, digits and hyphens",
  );

// Public reads only ever see published rows. The marketing site renders these
// on request, so the filter lives here rather than trusting each caller.
const publishedOnly = and(
  eq(post.published, true),
  isNotNull(post.publishedAt),
);

// The two public reads go through `dbCached`: every visitor runs the same
// query, and a post appearing one cache window late is acceptable for a blog.
// Authoring reads stay on `db` so a writer sees their own change at once.
export const blogRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.dbCached
      .select({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt,
      })
      .from(post)
      .where(publishedOnly)
      .orderBy(desc(post.publishedAt)),
  ),

  bySlug: publicProcedure
    .input(z.object({ slug }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.dbCached.query.post.findFirst({
        where: (p, { and, eq, isNotNull }) =>
          and(
            eq(p.slug, input.slug),
            eq(p.published, true),
            isNotNull(p.publishedAt),
          ),
      });

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }
      return row;
    }),

  // Public for testing: anyone can author, edit and delete any post. Before
  // shipping, switch the three procedures below to `protectedProcedure`,
  // scope `all` and `remove` on `ctx.user.id`, and restore `mine`.
  all: publicProcedure.query(({ ctx }) =>
    ctx.db.select().from(post).orderBy(desc(post.createdAt)),
  ),

  create: publicProcedure
    .input(
      z.object({
        slug,
        title: z.string().trim().min(1).max(200),
        excerpt: z.string().trim().min(1).max(500),
        content: z.string().trim().min(1).max(50_000),
        published: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.post.findFirst({
        columns: { id: true },
        where: (p, { eq }) => eq(p.slug, input.slug),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slug already in use",
        });
      }

      const [row] = await ctx.db
        .insert(post)
        .values({
          ...input,
          authorId: ctx.user?.id ?? null,
          publishedAt: input.published ? new Date() : null,
        })
        .returning();
      return row;
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .delete(post)
        .where(eq(post.id, input.id))
        .returning({ id: post.id });

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }
      return row;
    }),
});
