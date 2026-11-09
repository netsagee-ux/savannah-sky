import {useState,type FormEvent} from 'react';
import {ArrowRight,Check,Ellipsis,Search,X} from 'lucide-react';
import {courseImage} from './ui';
import {isConversion,type Course} from '@/lib/data';
export type StudioCourse=Course&{videos?:number;lesson_count?:number};
type Props={courses:StudioCourse[];busy:boolean;onLessons:(id:string)=>void;onEdit?:(course:StudioCourse)=>void;
  onCreate?:()=>void;onVisibility?:(e:FormEvent<HTMLFormElement>)=>void};
export default function WorkspaceLibrary({courses,busy,onLessons,onEdit,onVisibility,onCreate}:Props){
  const [search,setSearch]=useState('');
  const query=search.trim().toLowerCase();
  const filtered=courses.map((course,index)=>({course,index})).filter(({course})=>course.title.toLowerCase().includes(query));
  return <section className="studio-library" aria-label="Your courses">
    <div className="studio-library-bar"><h2>Your courses <span>{courses.length}</span></h2>
      {courses.length>0&&<label className="studio-search"><Search size={19} aria-hidden="true"/><input aria-label="Find a course" type="search"
        placeholder="Find a course" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Clear search" onClick={()=>setSearch('')}><X size={16}/></button>}</label>}
    </div>
    {filtered.length?<ul className="studio-course-list">{filtered.map(({course:c,index:i})=><li key={c.id}>
      <img alt="" src={courseImage(c,i,480)} width={76} height={76} loading={i<4?'eager':'lazy'}/>
      <div className="studio-course-copy"><button type="button" className="studio-course-title" onClick={()=>onLessons(c.id)} disabled={busy}>{c.title}</button>
        <p>{isConversion(c)?'Conversion':c.level}{c.level?' · ':''}{c.lesson_count??0} {c.lesson_count===1?'lesson':'lessons'}{onEdit&&c.price!=null?' · £'+(c.price/100).toLocaleString('en-GB',{maximumFractionDigits:2}):''}</p></div>
      <span className={'studio-badge'+(c.published?' is-published':'')}>{c.published?<Check size={14}/>:null}{c.published?'Published':'Draft'}</span>
      <div className="studio-course-actions"><button className="studio-open" type="button" disabled={busy} aria-label={'Manage lessons for '+c.title} onClick={()=>onLessons(c.id)}>Lessons <ArrowRight size={17}/></button>
        {onEdit&&onVisibility&&<details className="studio-more" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}
          onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.open=false;}}>
          <summary aria-label={'More actions for '+c.title}><Ellipsis size={20}/></summary><div>
            <button type="button" disabled={busy} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');onEdit(c);}}>Edit details</button>
            <form onSubmit={e=>{e.currentTarget.closest('details')?.removeAttribute('open');onVisibility(e);}}>
              <input name="id" type="hidden" value={c.id}/><input name="published" type="hidden" value={c.published?'0':'1'}/><button disabled={busy}>{c.published?'Unpublish':'Publish'}</button>
            </form></div></details>}</div></li>)}</ul>:<p className="studio-empty">{courses.length?'No courses match your search.':'No courses yet.'}{!courses.length&&onCreate&&<> <button type="button" className="studio-open" onClick={onCreate}>Add your first course <ArrowRight size={16}/></button></>}</p>}
  </section>;
}
