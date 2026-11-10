import {bucket, db, enrolled} from '@/lib/server';
import {lessonIdentifier, photoIdPattern} from '@/lib/lesson-photos';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, {params}: {params: Promise<{lessonId: string; photoId: string}>}) {
  const headers = new Headers({'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie, Authorization'});
  const missing = () => new Response('Photo unavailable', {status: 404, headers});
  const {lessonId, photoId} = await params;
  if (!lessonIdentifier.test(lessonId) || !photoIdPattern.test(photoId)) return missing();
  try {
    const row = await db().prepare(`SELECT l.course_id, json_extract(s.value,'$.key') AS storage_key
      FROM lessons l JOIN settings s ON s.id='lesson-photo/'||l.id||'/'||? WHERE l.id=?`)
      .bind(photoId, lessonId).first<{course_id: string; storage_key: string}>();
    if (!row || !await enrolled(row.course_id)) return missing();
    const photo = await bucket().get(row.storage_key);
    if (!photo) return missing();
    photo.writeHttpMetadata(headers);
    return new Response(photo.body, {headers});
  } catch {
    return new Response('Photo temporarily unavailable', {status: 503, headers});
  }
}
