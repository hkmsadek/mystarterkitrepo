// Courses and their lessons: the public catalogue rendered on request by the
// marketing site. Lessons carry an explicit position because a course outline
// is ordered by the author, not by creation time.

import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { generateId } from "./id";

export const course = pgTable("course", {
  id: text()
    .primaryKey()
    .$defaultFn(() => generateId("crs")),
  slug: text().notNull().unique(),
  title: text().notNull(),
  summary: text().notNull(),
  // Plain paragraphs separated by blank lines; the site renders them as <p>.
  description: text().notNull(),
  // Minor units (cents). 0 is a free course.
  priceCents: integer().default(0).notNull(),
  level: text().notNull(),
  published: boolean().default(false).notNull(),
  createdAt: timestamp({ withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const lesson = pgTable(
  "lesson",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generateId("lsn")),
    courseId: text()
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    title: text().notNull(),
    durationMinutes: integer().notNull(),
    // A free preview lesson is visible to visitors who have not enrolled.
    preview: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("lesson_course_id_idx").on(table.courseId),
    unique("lesson_course_id_position_unique").on(
      table.courseId,
      table.position,
    ),
  ],
);

export const courseRelations = relations(course, ({ many }) => ({
  lessons: many(lesson),
}));

export const lessonRelations = relations(lesson, ({ one }) => ({
  course: one(course, { fields: [lesson.courseId], references: [course.id] }),
}));

export type Course = typeof course.$inferSelect;
export type NewCourse = typeof course.$inferInsert;
export type Lesson = typeof lesson.$inferSelect;
export type NewLesson = typeof lesson.$inferInsert;
