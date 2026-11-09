"use client";
import QuizEditor from './quiz-editor';
import {readQuiz} from '@/lib/lesson-quiz';
import {useState, type FormEvent} from 'react';

type Lesson = {
  id:string; course_id:string; title:string; position:number; body:string; video_key:string|null;
  video_url:string|null; thumbnail_key:string|null; question:string|null; options:string|null; answer:number|null;
};
type Props = {
  courses:{id:string;title:string}[]; lessons:Lesson[]; selected:string; onSelect:(id:string)=>void;
  directUpload:boolean; busy:boolean; status:string; save:(event:FormEvent<HTMLFormElement>,action:string)=>Promise<boolean>;
};

export default function CourseLessons({courses,lessons,selected,onSelect,directUpload,busy,status,save}:Props) {
  const [lesson,setLesson]=useState<Lesson|null>(null);
  const [editorOpen,setEditorOpen]=useState(false);
  const [version,setVersion]=useState(0);
  const course=courses.find(item=>item.id===selected);
  const list=lessons.filter(item=>item.course_id===selected).sort((a,b)=>a.position-b.position || a.id.localeCompare(b.id));
  const videos=list.filter(item=>item.video_key).length;
  const nextPosition=Math.min(1000,list.reduce((max,item)=>Math.max(max,item.position),0)+1);
  async function submit(event:FormEvent<HTMLFormElement>) {
    if(await save(event,'lesson')) {setEditorOpen(false);setLesson(null);setVersion(value=>value+1);}
  }
  return <section className="admin-section">
    {!editorOpen&&<p className="status-message" role="status">{status}</p>}
    <label className="form">Course workspace<select aria-label="Course workspace" value={course?.id||''} disabled={busy} onChange={e=>onSelect(e.target.value)}>
      <option value="">Choose a course</option>{courses.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    {!course ? <p>Choose a course to manage its lessons and recordings.</p> : <>
      <div className="library-heading">
        <div><h2>{course.title}</h2><p>{list.length} {list.length===1?'lesson':'lessons'} · {videos} private {videos===1?'video':'videos'}</p></div>
        {!editorOpen && <button className="button" type="button" disabled={busy} onClick={()=>{setLesson(null);setEditorOpen(true);}}>Add a lesson</button>}
      </div>
      {!editorOpen && (list.length ? <ol className="academy-lesson-list">{list.map(item=><li key={item.id}>
        <div><strong>{item.title}</strong><small>{item.video_key?'Private video':item.body?'Lesson notes':'Knowledge check'}{item.question&&(item.video_key||item.body)?' · Knowledge check':''}</small></div>
        <div className="lesson-actions"><button type="button" className="edit-link" disabled={busy} aria-label={'Edit '+item.title} onClick={()=>{setLesson(item);setEditorOpen(true);}}>Edit</button>
        <a className="underlink" href={'/learn/'+encodeURIComponent(item.id)} aria-label={'Preview '+item.title}>Preview</a></div>
      </li>)}</ol> : <p>Add the first lesson to start your course library.</p>)}
      {editorOpen && <><div className="library-heading"><h3>{lesson?'Edit lesson':'Add a lesson'}</h3>
        <button type="button" disabled={busy} className="edit-link" onClick={()=>setEditorOpen(false)}>Back to lesson list</button></div>
      <form key={lesson?.id||'new-'+version} className="form" onSubmit={submit}>
        <input name="id" type="hidden" value={lesson?.id||''}/>
        <input name="courseId" type="hidden" value={course.id}/>
        <div className="form-two">
        <label>Lesson title<input name="title" required maxLength={120} defaultValue={lesson?.title||''}/>
        </label>
        <label>Position<input type="number" name="position" min="0" max="1000" defaultValue={lesson?.position??nextPosition}/>
        </label>
        </div>
        <label>Lesson notes (optional with a video or quiz)<textarea name="body" rows={6} maxLength={20000} defaultValue={lesson?.body||''}/>
        </label>
        <div className="notice">
        <strong>Private video hosting</strong>
        <p>New recordings are saved in {directUpload?'private Vercel Blob storage':'the encrypted academy database'}. Students watch here after signing in. MP4 (H.264) is recommended.</p>
        </div>
        <label>Private training video (MP4 or WebM, up to {directUpload?'1 GB':'256 MB'})<input name="video" type="file" accept="video/mp4,video/webm"/>
        </label>
        <label>Video thumbnail (JPG, PNG or WebP, up to 3 MB)<input name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp"/>
        </label>{lesson?.thumbnail_key&&<div className="admin-thumbnail">
        <img src={'/api/thumbnail/'+lesson.id} alt="Current lesson thumbnail" width={320} height={180}/>
        <label>Existing thumbnail<select name="removeThumbnail">
        <option value="0">Keep (or replace with upload)</option>
        <option value="1">Remove thumbnail</option>
        </select>
        </label>
        </div>}<p className="quiet">Thumbnails may be visible before enrolment. Do not upload private material as a thumbnail.</p>{lesson?.video_key&&<label>Existing uploaded video<select name="removeVideo">
        <option value="0">Keep video (or replace with upload above)</option>
        <option value="1">Remove existing video</option>
        </select>
        </label>}{lesson?.video_url&&!lesson.video_key&&<p>Upload this lesson’s original recording to enable private playback.</p>}<QuizEditor initial={readQuiz(lesson)}/>
        <p className="status-message" role="status">{status}</p>{status.includes('staff session')&&<a className="underlink" target="_blank" rel="noreferrer" href="/admin/login">Open staff sign-in</a>}
        <button className="button" disabled={busy}>{busy?'Uploading & saving…':'Save lesson'}</button></form></>}
    </>}
  </section>;
}
