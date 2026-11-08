import {upload} from '@vercel/blob/client';
import {lessonVideoTypes, maxLessonBytes, mediaPartBytes, classroomVideoLimit} from '@/lib/lesson-upload';

const staged = new WeakMap<File, {course: string; pathname: string; nextPart?:number}>();

export async function uploadLessonVideo(form: FormData, report: (message: string) => void, direct:boolean) {
  const file = form.get('video');
  if (!(file instanceof File) || !file.size) return;
  if (!lessonVideoTypes.includes(file.type) || file.size > maxLessonBytes) throw Error('Choose an MP4 or WebM file up to 1 GB.');
  if(!direct && file.size>classroomVideoLimit) throw Error('Choose an MP4 or WebM up to 256 MB.');
  const course = String(form.get('courseId'));
  let key = staged.get(file);
  if (!direct) {
    if(!key || key.course!==course) {
      key={course,pathname:'classroom/'+course+'/'+crypto.randomUUID(),nextPart:0};
      staged.set(file,key);
    }
    const count=Math.ceil(file.size/mediaPartBytes);
    for(let part=key.nextPart??0;part<count;part++){
      report('Uploading private video · '+Math.floor(part/count*100)+'%');
      const params=new URLSearchParams({key:key.pathname,size:String(file.size),part:String(part)});
      const response=await fetch('/api/admin/video-part?'+params,{method:'POST',headers:{'Content-Type':file.type},
        body:file.slice(part*mediaPartBytes,(part+1)*mediaPartBytes)});
      if(!response.ok)throw Error('Upload paused. Press Save lesson to retry.');
      key.nextPart=part+1;
    }
  } else if (key?.course !== course) {
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
