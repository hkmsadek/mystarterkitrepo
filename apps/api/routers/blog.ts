import { post } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../lib/trpc.js";

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

export const blogRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.db
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
      const row = await ctx.db.query.post.findFirst({
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

  // The signed-in user's own posts, drafts included.
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(post)
      .where(eq(post.authorId, ctx.user.id))
      .orderBy(desc(post.createdAt)),
  ),

  create: protectedProcedure
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
          authorId: ctx.user.id,
          publishedAt: input.published ? new Date() : null,
        })
        .returning();
      return row;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .delete(post)
        .where(and(eq(post.id, input.id), eq(post.authorId, ctx.user.id)))
        .returning({ id: post.id });

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }
      return row;
    }),
});
