import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const divisionAttempts = sqliteTable("division_attempts", {
  attemptId: text("attempt_id").primaryKey(),
  className: text("class_name").notNull(),
  studentNo: integer("student_no").notNull(),
  dividend: integer("dividend").notNull(),
  divisor: integer("divisor").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
});
