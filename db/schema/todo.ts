// Personal todo items. Scoped to a user, not an organization: the list is
// private to whoever created it, so no membership check is involved.

import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { generateId } from "./id";
import { user } from "./user";

export const todo = pgTable(
  "todo",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generateId("tdo")),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text().notNull(),
    completed: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("todo_user_id_idx").on(table.userId)],
);

export const todoRelations = relations(todo, ({ one }) => ({
  user: one(user, { fields: [todo.userId], references: [user.id] }),
}));

export type Todo = typeof todo.$inferSelect;
export type NewTodo = typeof todo.$inferInsert;
