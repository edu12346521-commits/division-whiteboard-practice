CREATE TABLE `division_attempts` (
	`attempt_id` text PRIMARY KEY NOT NULL,
	`class_name` text NOT NULL,
	`student_no` integer NOT NULL,
	`dividend` integer NOT NULL,
	`divisor` integer NOT NULL,
	`completed_at` integer NOT NULL
);
