import {bucket, db} from './server';
import {maxLessonPhotos, photoIdPattern, photoKey, type LessonPhoto} from './lesson-photos';

export async function prepareLessonPhotos(form: FormData, course: string, lesson: string, moveThumbnail: string | null) {
  const database = db(), prefix = 'lesson-photo/' + lesson + '/';
  const rows = (await database.prepare('SELECT id FROM settings WHERE id GLOB ? ORDER BY rowid')
    .bind(prefix + '*').all<{id: string}>()).results;
  const current = new Set(rows.map(row => row.id.slice(prefix.length)));
  const remove = new Set(form.getAll('removePhoto').map(String));
  const additions: LessonPhoto[] = JSON.parse(String(form.get('addPhotos') || '[]'));
  if (!Array.isArray(additions) || additions.length > maxLessonPhotos || remove.size > maxLessonPhotos) {
    throw Error('Use up to 30 private photos per lesson.');
  }
  const statements = [];
  for (const id of current) {
    if (remove.has(id)) {
      statements.push(database.prepare('DELETE FROM settings WHERE id=?').bind(prefix + id));
    } else if (form.has('caption/' + id)) {
      const caption = String(form.get('caption/' + id)).trim();
      if (caption.length > 200) throw Error('Keep each photo caption within 200 characters.');
      statements.push(database.prepare("UPDATE settings SET value=json_set(value,'$.caption',?) WHERE id=?").bind(caption, prefix + id));
    }
  }
  const remaining = new Set([...current].filter(id => !remove.has(id)));
  for (const photo of additions) {
    if (!photo || !photoIdPattern.test(photo.id) || typeof photo.caption !== 'string' || photo.caption.length > 200) {
      throw Error('Check the selected photos and captions.');
    }
    const key = photoKey(course, lesson, photo.id);
    if (!await bucket().head(key)) throw Error('Upload each photo before saving.');
    statements.push(database.prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)')
      .bind(prefix + photo.id, JSON.stringify({key, caption: photo.caption.trim()})));
    remaining.add(photo.id);
  }
  if (moveThumbnail) {
    const id = crypto.randomUUID(), key = photoKey(course, lesson, id);
    const image = await bucket().get(moveThumbnail);
    if (!image) throw Error('The existing thumbnail could not be opened. Select the original photo instead.');
    const headers = new Headers();
    image.writeHttpMetadata(headers);
    await bucket().put(key, await new Response(image.body).arrayBuffer(), {httpMetadata: {contentType: headers.get('content-type') || 'image/jpeg'}});
    statements.push(database.prepare('INSERT INTO settings(id,value) VALUES(?,?)').bind(prefix + id, JSON.stringify({key, caption: ''})));
    remaining.add(id);
  }
  if (remaining.size > maxLessonPhotos) throw Error('Use up to 30 private photos per lesson.');
  // Compare the photo IDs at commit time so simultaneous edits cannot bypass the limits
  // or leave a photo-only lesson empty. A failed guard rolls back the entire batch.
  const guard = database.prepare(`SELECT json(CASE WHEN
    (SELECT json_group_array(id) FROM (SELECT id FROM settings WHERE id GLOB ? ORDER BY rowid))=?
    THEN 'true' ELSE 'lesson photos changed' END)`).bind(prefix + '*', JSON.stringify(rows.map(row => row.id)));
  return {count: remaining.size, statements: [guard, ...statements]};
}
