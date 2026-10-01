import { user } from "@repo/db";
import { createTestDatabase } from "@repo/db/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { TRPCContext } from "../lib/context";
import { createCallerFactory } from "../lib/trpc";
import { blogRouter } from "./blog";

const createCaller = createCallerFactory(blogRouter);

const { db, reset, close } = await createTestDatabase();

afterAll(close);
beforeEach(reset);

async function insertUser(email: string) {
  const [row] = await db
    .insert(user)
    .values({ name: "Author", email, emailVerified: true })
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
          email: "author@example.com",
          emailVerified: true,
          name: "Author",
        }
      : null,
    db,
    dbCached: db,
    env: {} as TRPCContext["env"],
  };
  return createCaller(ctx);
}

const draft = {
  slug: "draft",
  title: "Draft",
  excerpt: "Not yet",
  content: "Hidden",
  published: false,
};

describe("blog", () => {
  it("publishes a post and serves it publicly by slug", async () => {
    const author = callerFor(await insertUser("a@example.com"));
    const anonymous = callerFor(null);

    const created = await author.create({
      slug: "hello-world",
      title: "Hello",
      excerpt: "First",
      content: "Body",
    });
    expect(created.id).toMatch(/^pst_/);
    expect(created.publishedAt).toBeInstanceOf(Date);

    const listed = await anonymous.list();
    expect(listed.map((p) => p.slug)).toEqual(["hello-world"]);

    const found = await anonymous.bySlug({ slug: "hello-world" });
    expect(found.title).toBe("Hello");
  });

  it("keeps drafts out of public reads but in the author's own list", async () => {
    const author = callerFor(await insertUser("a@example.com"));
    const anonymous = callerFor(null);

    await author.create(draft);

    expect(await anonymous.list()).toEqual([]);
    await expect(anonymous.bySlug({ slug: "draft" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await author.mine()).map((p) => p.slug)).toEqual(["draft"]);
  });

  it("rejects a duplicate slug and a malformed slug", async () => {
    const author = callerFor(await insertUser("a@example.com"));
    await author.create(draft);

    await expect(author.create(draft)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      author.create({ ...draft, slug: "Not A Slug" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires a session to write and lets only the author delete", async () => {
    const alice = callerFor(await insertUser("alice@example.com"));
    const bob = callerFor(await insertUser("bob@example.com"));
    const anonymous = callerFor(null);

    await expect(anonymous.create(draft)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    const mine = await alice.create(draft);
    await expect(bob.remove({ id: mine.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await alice.remove({ id: mine.id });
    expect(await alice.mine()).toEqual([]);
  });
});
