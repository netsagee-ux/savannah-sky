'use client';
import {useState} from 'react';
import {lessonPhotoUrl, maxLessonPhotos, maxPhotoBytes, type LessonPhoto} from '@/lib/lesson-photos';
import {StaffSessionError} from './upload-lesson-video';

const uploads = new WeakMap<File, {lesson: string; id: string}>();

export async function stageLessonPhotos(form: FormData, files: File[], report: (status: string) => void) {
  const lesson = String(form.get('id') || form.get('creationId'));
  const course = String(form.get('courseId'));
  if (files.length > maxLessonPhotos || files.some(file => file.size > maxPhotoBytes || !file.size)) {
    throw Error('Choose up to 30 photos, each 3 MB or smaller.');
  }
  form.delete('privatePhotos');
  const captions = form.getAll('newPhotoCaption');
  form.delete('newPhotoCaption');
  const additions: LessonPhoto[] = [];
  for (const [index, file] of files.entries()) {
    let upload = uploads.get(file);
    if (upload?.lesson !== lesson) {
      upload = {lesson, id: crypto.randomUUID()};
      uploads.set(file, upload);
    }
    report('Uploading private photo ' + (index + 1) + ' of ' + files.length + '…');
    const params = new URLSearchParams({course, lesson, image: upload.id});
    const response = await fetch('/api/admin/lesson-photos?' + params, {method: 'POST', body: file});
    if (response.status === 401 || response.status === 403) throw new StaffSessionError();
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as {error?: string};
      throw Error(error.error || 'Photo upload paused. Please try saving the lesson again.');
    }
    additions.push({id: upload.id, caption: String(captions[index] || '')});
  }
  form.set('addPhotos', JSON.stringify(additions));
}

export default function LessonPhotos({lessonId, photos}: {lessonId?: string; photos: LessonPhoto[]}) {
  const [files, setFiles] = useState<File[]>([]);
  return <fieldset className="private-lesson-photos"><legend>Private lesson photos</legend>
    <p>Add teaching diagrams or step-by-step photos. Only you and students enrolled on this course can open them.</p>
    {lessonId && photos.map((photo, i) => <div className="lesson-photo-entry" key={photo.id}>
      <img src={lessonPhotoUrl(lessonId, photo.id)} alt={photo.caption || 'Lesson photo ' + (i + 1)} loading="lazy"/>
      <label>Caption<input name={'caption/' + photo.id} defaultValue={photo.caption} maxLength={200}/></label>
      <label className="remove-lesson-photo"><input type="checkbox" name="removePhoto" value={photo.id}/> Remove photo</label>
    </div>)}
    <label>Add photos<input type="file" name="privatePhotos" multiple accept="image/jpeg,image/png,image/webp"
      onChange={e => setFiles(Array.from(e.currentTarget.files || []))}/></label>
    <small>JPG, PNG or WebP. Up to 3 MB each and 30 photos per lesson.</small>
    {files.map((file, index) => <label key={index + '/' + file.name + '/' + file.lastModified}>
      Caption for {file.name} (optional)<input name="newPhotoCaption" maxLength={200}/>
    </label>)}
  </fieldset>;
}
