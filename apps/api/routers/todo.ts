import { todo } from "@repo/db";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../lib/trpc.js";

// Public for testing: one shared list, no sign-in required. Before shipping,
// switch to `protectedProcedure` and filter every query on `ctx.user.id`.
const todoId = z.object({ id: z.string().min(1) });

export const todoRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.db.select().from(todo).orderBy(desc(todo.createdAt)),
  ),

  create: publicProcedure
    .input(z.object({ title: z.string().trim().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(todo)
        .values({ title: input.title })
        .returning();
      return row;
    }),

  setCompleted: publicProcedure
    .input(todoId.extend({ completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .update(todo)
        .set({ completed: input.completed })
        .where(eq(todo.id, input.id))
        .returning();

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Todo not found" });
      }
      return row;
    }),

  remove: publicProcedure.input(todoId).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .delete(todo)
      .where(eq(todo.id, input.id))
      .returning({ id: todo.id });

    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Todo not found" });
    }
    return row;
  }),
});
