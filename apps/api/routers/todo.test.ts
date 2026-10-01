import { user } from "@repo/db";
import { createTestDatabase } from "@repo/db/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { TRPCContext } from "../lib/context";
import { createCallerFactory } from "../lib/trpc";
import { todoRouter } from "./todo";

const createCaller = createCallerFactory(todoRouter);

const { db, reset, close } = await createTestDatabase();

afterAll(close);
beforeEach(reset);

async function insertUser(email: string) {
  const [row] = await db
    .insert(user)
    .values({ name: "Test User", email, emailVerified: true })
    .returning();
  return row.id;
}

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
          email: "test@example.com",
          emailVerified: true,
          name: "Test User",
        }
      : null,
    db,
    dbCached: db,
    env: {} as TRPCContext["env"],
  };
  return createCaller(ctx);
}

describe("todo", () => {
  it("creates, completes, and removes a todo", async () => {
    const caller = callerFor(await insertUser("a@example.com"));

    const created = await caller.create({ title: "  Write tests  " });
    expect(created.title).toBe("Write tests");
    expect(created.completed).toBe(false);
    expect(created.id).toMatch(/^tdo_/);

    const done = await caller.setCompleted({ id: created.id, completed: true });
    expect(done.completed).toBe(true);

    await caller.remove({ id: created.id });
    expect(await caller.list()).toEqual([]);
  });

  it("rejects an empty title and an anonymous caller", async () => {
    const caller = callerFor(await insertUser("a@example.com"));
    await expect(caller.create({ title: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(callerFor(null).list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("never exposes another user's todos", async () => {
    const alice = callerFor(await insertUser("alice@example.com"));
    const bob = callerFor(await insertUser("bob@example.com"));

    const mine = await alice.create({ title: "Alice's todo" });
    await bob.create({ title: "Bob's todo" });

    expect((await alice.list()).map((t) => t.title)).toEqual(["Alice's todo"]);

    await expect(
      bob.setCompleted({ id: mine.id, completed: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(bob.remove({ id: mine.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
