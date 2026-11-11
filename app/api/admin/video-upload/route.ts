import {sameSiteOrigin} from '@/lib/request-origin';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { admin, db } from '@/lib/server';
import { lessonUploadCourse, lessonVideoTypes, maxLessonBytes } from '@/lib/lesson-upload';

export async function POST(request: Request) {
  if (!sameSiteOrigin(request) || !await admin()) {
    return Response.json({error: 'Administrator access required.'}, {status: 403});
  }
  try {
    const body: HandleUploadBody = await request.json();
    if (body.type !== 'blob.generate-client-token') return Response.json({error: 'Invalid upload request.'}, {status: 400});
    const result = await handleUpload({request, body, onBeforeGenerateToken: async (pathname) => {
      const course = lessonUploadCourse(pathname);
      if (!course || !await db().prepare('SELECT id FROM courses WHERE id=?').bind(course).first()) throw Error('Choose an existing course.');
      return {allowedContentTypes: lessonVideoTypes, maximumSizeInBytes: maxLessonBytes, addRandomSuffix: false, allowOverwrite: false};
    }});
    return Response.json(result, {headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error: 'Unable to authorise the private video upload.'}, {status: 400});}
}
