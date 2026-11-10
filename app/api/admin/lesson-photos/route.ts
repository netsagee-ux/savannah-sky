import {admin, bucket, db} from '@/lib/server';
import {maxPhotoBytes, photoKey} from '@/lib/lesson-photos';
import {imageContentType} from '@/lib/video-security';

export async function POST(request: Request) {
  if (!await admin() || request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({error: 'Staff sign-in required.'}, {status: 403});
  }
  const params = new URL(request.url).searchParams;
  const course = params.get('course') || '', lesson = params.get('lesson') || '';
  const id = params.get('image') || '';
  try {
    const key = photoKey(course, lesson, id);
    if (!await db().prepare('SELECT id FROM courses WHERE id=?').bind(course).first()) {
      return Response.json({error: 'Course not found.'}, {status: 404});
    }
    if (Number(request.headers.get('content-length')) > maxPhotoBytes) {
      return Response.json({error: 'Each photo must be 3 MB or smaller.'}, {status: 413});
    }
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > maxPhotoBytes) {
      return Response.json({error: 'Choose a photo up to 3 MB.'}, {status: 413});
    }
    const type = imageContentType(new Uint8Array(bytes));
    if (!type) return Response.json({error: 'Choose a JPG, PNG or WebP image.'}, {status: 415});
    await bucket().put(key, bytes, {httpMetadata: {contentType: type}});
    return Response.json({id});
  } catch {
    return Response.json({error: 'The photo could not be uploaded. Try saving the lesson again.'}, {status: 400});
  }
}
