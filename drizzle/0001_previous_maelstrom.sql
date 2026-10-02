CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_profile_email` ON `profiles` (`email`);--> statement-breakpoint
CREATE INDEX `idx_enrollment_email_course` ON `enrollments` (`email`,`course_id`);--> statement-breakpoint
CREATE INDEX `idx_lessons_course` ON `lessons` (`course_id`);