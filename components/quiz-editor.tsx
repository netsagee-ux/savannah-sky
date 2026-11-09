'use client';
import {useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import type {QuizQuestion} from '@/lib/lesson-quiz';

export default function QuizEditor({initial}:{initial:QuizQuestion[]}){
  const [rows,setRows]=useState(()=>initial.map((q,i)=>({...q,key:String(i)})));
  function update(key:string,values:Partial<QuizQuestion>){
    setRows(old=>old.map(q=>q.key===key?{...q,...values}:q));
  }
  return <section className="lesson-question-editor" aria-label="Multiple-choice questions">
    <h3>Knowledge check</h3>
    <input type="hidden" name="quiz" value={JSON.stringify(rows.map(({question,options,answer})=>({question,options,answer})))}/>
    {rows.map((q,i)=><fieldset key={q.key}><legend>Question {i+1}</legend>
      <label>Question text<textarea required rows={2} maxLength={500} value={q.question} onChange={e=>update(q.key,{question:e.target.value})}/></label>
      {q.options.map((option,j)=><label key={j}>Option {j+1}<input required maxLength={300} value={option}
        onChange={e=>update(q.key,{options:q.options.map((v,k)=>j===k?e.target.value:v)})}/></label>)}
      <div className="quiz-actions">{q.options.length<6&&<button type="button" className="edit-link" onClick={()=>update(q.key,{options:[...q.options,'']})}>Add option</button>}
      {q.options.length>2&&<button type="button" className="edit-link" onClick={()=>update(q.key,{options:q.options.slice(0,-1),answer:q.answer===q.options.length-1?-1:q.answer})}>Remove last option</button>}</div>
      <label>Correct answer<select required value={q.answer<0?'':q.answer} onChange={e=>update(q.key,{answer:Number(e.target.value)})}>
        <option value="" disabled>Choose the correct option</option>{q.options.map((v,j)=><option key={j} value={j}>Option {j+1}{v?' · '+v.slice(0,45):''}</option>)}
      </select></label><button type="button" className="edit-link" onClick={()=>setRows(rows.filter(x=>x.key!==q.key))}><Trash2 size={15}/> Remove question {i+1}</button>
    </fieldset>)}
    {rows.length<50&&<button type="button" className="button outline" onClick={()=>setRows([...rows,{key:crypto.randomUUID(),question:'',options:['','',''],answer:-1}])}><Plus size={16}/> Add question</button>}
  </section>;
}
