import { createTestDatabase } from "@repo/db/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { TRPCContext } from "../lib/context";
import { createCallerFactory } from "../lib/trpc";
import { todoRouter } from "./todo";

const createCaller = createCallerFactory(todoRouter);

const { db, reset, close } = await createTestDatabase();

afterAll(close);
beforeEach(reset);

// Anonymous caller: the router is public while the feature is under test.
const caller = createCaller({
  req: new Request("http://localhost"),
  info: {} as TRPCContext["info"],
  session: null,
  user: null,
  db,
  dbCached: db,
  env: {} as TRPCContext["env"],
});

describe("todo", () => {
  it("creates, completes, and removes a todo without a session", async () => {
    const created = await caller.create({ title: "  Write tests  " });
    expect(created.title).toBe("Write tests");
    expect(created.completed).toBe(false);
    expect(created.userId).toBeNull();
    expect(created.id).toMatch(/^tdo_/);

    const done = await caller.setCompleted({ id: created.id, completed: true });
    expect(done.completed).toBe(true);

    expect((await caller.list()).map((t) => t.id)).toEqual([created.id]);

    await caller.remove({ id: created.id });
    expect(await caller.list()).toEqual([]);
  });

  it("rejects an empty title", async () => {
    await expect(caller.create({ title: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("reports a missing todo as NOT_FOUND", async () => {
    await expect(
      caller.setCompleted({ id: "tdo_missing", completed: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.remove({ id: "tdo_missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
