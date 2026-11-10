export const maxPhotoBytes = 3 * 1024 * 1024;
export const maxLessonPhotos = 30;
export const photoIdPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export const lessonIdentifier = /^[a-zA-Z0-9_-]{1,128}$/;

export type LessonPhoto = {id: string; caption: string};

export function photoKey(courseId: string, lessonId: string, photoId: string) {
  if (!lessonIdentifier.test(courseId) || !lessonIdentifier.test(lessonId) || !photoIdPattern.test(photoId)) {
    throw Error('Reopen the lesson and choose the image again.');
  }
  return 'classroom-assets/diagrams/' + courseId + '/' + lessonId + '/' + photoId;
}

export function lessonPhotoUrl(lessonId: string, photoId: string) {
  return '/api/lesson-photos/' + encodeURIComponent(lessonId) + '/' + encodeURIComponent(photoId);
}
