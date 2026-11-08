import {upload} from '@vercel/blob/client';
import {lessonVideoTypes, maxLessonBytes} from '@/lib/lesson-upload';

const staged = new WeakMap<File, {course: string; pathname: string}>();

export async function uploadLessonVideo(form: FormData, report: (message: string) => void) {
  const file = form.get('video');
  if (!(file instanceof File) || !file.size) return;
  if (!lessonVideoTypes.includes(file.type) || file.size > maxLessonBytes) throw Error('Choose an MP4 or WebM file up to 1 GB.');
  const course = String(form.get('courseId'));
  let key = staged.get(file);
  if (key?.course !== course) {
    const extension = file.type === 'video/webm' ? 'webm' : 'mp4';
    const pathname = 'lessons/uploads/' + course + '/' + crypto.randomUUID() + '.' + extension;
    report('Uploading private video…');
    const result = await upload(pathname, file, {
      access: 'private', handleUploadUrl: '/api/admin/video-upload', multipart: true, contentType: file.type,
      onUploadProgress: ({percentage}) => report('Uploading private video · ' + Math.round(percentage) + '%'),
    });
    key = {course, pathname: result.pathname};
    staged.set(file, key);
  }
  form.delete('video');
  form.set('uploadedVideoKey', key.pathname);
  report('Saving lesson…');
}
