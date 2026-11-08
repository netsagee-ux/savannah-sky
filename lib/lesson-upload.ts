export const maxLessonBytes = 1024 ** 3;
export const lessonVideoTypes = ['video/mp4', 'video/webm'];

export function lessonUploadCourse(pathname: string) {
  return /^lessons\/uploads\/([a-zA-Z0-9_-]{1,128})\/[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\.(?:mp4|webm)$/.exec(pathname)?.[1];
}

export const mediaPartBytes=512*1024;
export const classroomVideoLimit=256*1024*1024;
export function classroomVideoCourse(key:string) {
  return /^classroom\/([a-zA-Z0-9_-]{1,128})\/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.exec(key)?.[1];
}
