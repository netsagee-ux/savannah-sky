export const maxLessonBytes = 1024 ** 3;
export const lessonVideoTypes = ['video/mp4', 'video/webm'];

export function lessonUploadCourse(pathname: string) {
  return /^lessons\/uploads\/([a-zA-Z0-9_-]{1,128})\/[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\.(?:mp4|webm)$/.exec(pathname)?.[1];
}
