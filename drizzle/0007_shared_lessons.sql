CREATE TABLE IF NOT EXISTS lesson_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_assignment_pair ON lesson_assignments(lesson_id,course_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_course ON lesson_assignments(course_id, active, position, id);
--> statement-breakpoint
-- Preserve original lesson URLs, bookmarks, progress and certificates.
INSERT INTO lesson_assignments (id, lesson_id, course_id, position)
SELECT id, id, course_id, position FROM lessons WHERE true
ON CONFLICT(lesson_id,course_id) DO NOTHING;
--> statement-breakpoint
-- Older writers and seed imports still insert the original course with the content.
CREATE TRIGGER IF NOT EXISTS assign_original_lesson AFTER INSERT ON lessons
BEGIN
  INSERT INTO lesson_assignments(id, lesson_id, course_id, position)
  VALUES (NEW.id, NEW.id, NEW.course_id, NEW.position);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS order_original_lesson AFTER UPDATE OF position ON lessons
WHEN NEW.position <> OLD.position
BEGIN
  UPDATE lesson_assignments SET position=NEW.position WHERE id=NEW.id;
END;
--> statement-breakpoint
CREATE VIEW IF NOT EXISTS course_lessons AS
SELECT a.id, a.course_id, a.position, l.id AS source_id, l.title, l.body,
       l.video_key, l.thumbnail_key, l.video_url, l.resource_url, l.question, l.options, l.answer
FROM lesson_assignments a JOIN lessons l ON l.id=a.lesson_id
WHERE a.active=1;
