import {db} from './server';

// An inactive placement retains its URL and progress if staff later restore it.
export function linkToCourse(lessonId:string, courseId:string) {
  return db().prepare(`INSERT INTO lesson_assignments(id,lesson_id,course_id,position)
    VALUES(?,?,?,(SELECT min(1000,coalesce(max(position),0)+1) FROM lesson_assignments WHERE course_id=? AND active=1))
    ON CONFLICT(lesson_id,course_id) DO UPDATE SET active=1`)
    .bind(crypto.randomUUID(),lessonId,courseId,courseId);
}

export async function lessonAssignmentChanges(form:FormData, lessonId:string, courseId:string, position:number, creating:boolean) {
  const database=db();
  const setPosition=database.prepare('UPDATE lesson_assignments SET position=? WHERE lesson_id=? AND course_id=?')
    .bind(position,lessonId,courseId);
  // Older editors only submit the lesson's position within the open course.
  if(!form.has('assignmentCourses'))return [setPosition];

  const selected=[...new Set(form.getAll('assignedCourse').map(String))];
  if(!selected.length)throw Error('Select at least one course for this lesson.');
  if(creating && !selected.includes(courseId))throw Error('Include the current course when adding a new lesson.');
  const ids=JSON.stringify(selected);
  const matches=await database.prepare('SELECT count(*) AS total FROM courses WHERE id IN (SELECT value FROM json_each(?))')
    .bind(ids).first<{total:number}>();
  if(matches?.total!==selected.length)throw Error('A selected course is no longer available. Reopen the lesson.');

  const changes=[];
  if(!creating){
    // Verify the form's original selection inside the write transaction before replacing it.
    changes.push(database.prepare(`SELECT json(CASE WHEN
      (SELECT json_group_array(course_id) FROM (SELECT course_id FROM lesson_assignments WHERE lesson_id=? AND active=1 ORDER BY course_id))=?
      THEN 'true' ELSE 'assignments changed' END)`).bind(lessonId,String(form.get('previousCourses')||'')));
  }
  changes.push(database.prepare(`UPDATE lesson_assignments SET active=0 WHERE lesson_id=? AND active=1
    AND course_id NOT IN (SELECT value FROM json_each(?))`).bind(lessonId,ids));
  for(const id of selected)changes.push(linkToCourse(lessonId,id));
  changes.push(setPosition);
  return changes;
}
