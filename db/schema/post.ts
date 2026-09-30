// Blog posts rendered by the marketing site on request. Reads are public and
// filtered on `published`; writes go through the signed-in app.

import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateId } from "./id";
import { user } from "./user";

export const post = pgTable(
  "post",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generateId("pst")),
    // Set null, not cascade: a post outlives its author's account.
    authorId: text().references(() => user.id, { onDelete: "set null" }),
    slug: text().notNull().unique(),
    title: text().notNull(),
    excerpt: text().notNull(),
    // Plain paragraphs separated by blank lines; the site renders them as <p>.
    content: text().notNull(),
    published: boolean().default(false).notNull(),
    publishedAt: timestamp({ withTimezone: true, mode: "date" }),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("post_author_id_idx").on(table.authorId)],
);

export const postRelations = relations(post, ({ one }) => ({
  author: one(user, { fields: [post.authorId], references: [user.id] }),
}));

export type Post = typeof post.$inferSelect;
export type NewPost = typeof post.$inferInsert;
