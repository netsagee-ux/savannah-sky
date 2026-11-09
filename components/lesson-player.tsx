'use client';
import PrivateVideo from './private-video';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
type Lesson={id:string;title:string;body:string;questions:{question:string;options:string[]}[];hasVideo:boolean;hasThumbnail:boolean};
export default function LessonPlayer({lesson,completed}:{lesson:Lesson;completed:boolean}){
  const router=useRouter(),[answers,setAnswers]=useState<(number|null)[]>(()=>lesson.questions.map(()=>null));
  const [done,setDone]=useState(completed),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function complete(){
    setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:lesson.id,answers})});
      const result=await response.json() as {error?:string};if(!response.ok)throw Error(result.error);
      setDone(true);router.refresh();setMessage('Lesson complete. Your progress has been saved.');
    }catch(e){setMessage((e as Error).message||'Please try again.');}finally{setBusy(false);}
  }
  return <><h1>{lesson.title}</h1>{lesson.hasVideo&&<PrivateVideo lessonId={lesson.id} title={lesson.title} thumbnail={lesson.hasThumbnail}/>}
    {lesson.body&&<p className="lesson-content">{lesson.body}</p>}<div className="quiz"><h2>Knowledge check</h2>
      {lesson.questions.length?lesson.questions.map((q,i)=><fieldset key={i} disabled={done||busy}><legend>{i+1}. {q.question}</legend>
        {q.options.map((v,j)=><label key={j}><input type="radio" name={'answer-'+i} checked={answers[i]===j}
          onChange={()=>setAnswers(answers.map((a,k)=>k===i?j:a))}/>{v}</label>)}</fieldset>):
        <p>When you have worked through the lesson, mark it as complete.</p>}
      <button className="button" disabled={busy||done||answers.includes(null)} onClick={complete}>{done?'Lesson completed':busy?'Saving…':lesson.questions.length?'Check answers & complete':'Mark lesson complete'}</button>
      <p role="status">{message}</p></div></>;
}
