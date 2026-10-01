import { todo } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../lib/trpc.js";

// Every procedure filters on `userId` as well as `id`, so a caller can only
// ever read or change their own rows. A missing row and someone else's row are
// deliberately indistinguishable: both are NOT_FOUND.
const todoId = z.object({ id: z.string().min(1) });

export const todoRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(todo)
      .where(eq(todo.userId, ctx.user.id))
      .orderBy(desc(todo.createdAt)),
  ),

  create: protectedProcedure
    .input(z.object({ title: z.string().trim().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(todo)
        .values({ userId: ctx.user.id, title: input.title })
        .returning();
      return row;
    }),

  setCompleted: protectedProcedure
    .input(todoId.extend({ completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .update(todo)
        .set({ completed: input.completed })
        .where(and(eq(todo.id, input.id), eq(todo.userId, ctx.user.id)))
        .returning();

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Todo not found" });
      }
      return row;
    }),

  remove: protectedProcedure.input(todoId).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .delete(todo)
      .where(and(eq(todo.id, input.id), eq(todo.userId, ctx.user.id)))
      .returning({ id: todo.id });

    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Todo not found" });
    }
    return row;
  }),
});
