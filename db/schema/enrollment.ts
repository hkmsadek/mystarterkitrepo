// A user's place in a course. One row per (user, course); progress will hang
// off this row when lesson completion is tracked.

import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { course } from "./course";
import { generateId } from "./id";
import { user } from "./user";

export const enrollment = pgTable(
  "enrollment",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generateId("enr")),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text()
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("enrollment_user_id_idx").on(table.userId),
    index("enrollment_course_id_idx").on(table.courseId),
    unique("enrollment_user_id_course_id_unique").on(
      table.userId,
      table.courseId,
    ),
  ],
);

export const enrollmentRelations = relations(enrollment, ({ one }) => ({
  user: one(user, { fields: [enrollment.userId], references: [user.id] }),
  course: one(course, {
    fields: [enrollment.courseId],
    references: [course.id],
  }),
}));

export type Enrollment = typeof enrollment.$inferSelect;
