import {useState, type FormEvent} from 'react';
import {ArrowUpRight, BookOpen, Check, Columns3, Ellipsis, LayoutList, Plus, SearchX, SlidersHorizontal, Video, X} from 'lucide-react';
import {accredited, courseSummary, isConversion, type Course} from '@/lib/data';
import {courseImage} from './ui';

export type StudioCourse = Course & {videos?:number; lesson_count?:number};
type Props = {courses:StudioCourse[]; search:string; busy:boolean; onLessons:(id:string)=>void;
  onEdit:(course:StudioCourse)=>void; onCreate:()=>void; onVisibility:(e:FormEvent<HTMLFormElement>)=>void};
const lanes = [
  {key:'core', name:'Core training', colours:['blue','lilac','rose']},
  {key:'art', name:'Nail artistry', colours:['apricot','rose']},
  {key:'conversion', name:'Conversions', colours:['orchid','blue']},
  {key:'programme', name:'Programmes', colours:['mint','apricot']},
] as const;

function subject(course:StudioCourse) {
  if(isConversion(course)) return 'conversion';
  if(/\b(programmes?|programs?|diplomas?|complete)\b/i.test(course.title)) return 'programme';
  if(course.level==='Creative'||/\b(nail art|nail artistry|nail design|hand[- ]paint)/i.test(course.title)) return 'art';
  return 'core';
}

export default function WorkspaceLibrary({courses,search,busy,onLessons,onEdit,onCreate,onVisibility}:Props) {
  const [mode,setMode]=useState<'board'|'list'>('board');
  const [status,setStatus]=useState('all');
  const [showFilter,setShowFilter]=useState(false);
  const query=search.trim().toLowerCase();
  const matches=courses.filter(c=>c.title.toLowerCase().includes(query) &&
    (status==='all'||(status==='published')===Boolean(c.published)));
  const filtered=Boolean(query)||status!=='all';
  const actions=(c:StudioCourse)=><details className="studio-more"
    onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}
    onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))e.currentTarget.open=false;}}>
    <summary aria-label={'More actions for '+c.title} title="Course actions"><Ellipsis size={17}/></summary>
    <div><button type="button" disabled={busy} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');onEdit(c);}}>Edit course</button>
    <form onSubmit={e=>{e.currentTarget.closest('details')?.removeAttribute('open');onVisibility(e);}}>
      <input type="hidden" name="id" value={c.id}/><input type="hidden" name="published" value={c.published?'0':'1'}/>
      <button disabled={busy}>{c.published?'Unpublish':'Publish'}</button></form></div></details>;

  return <section className="studio-library" aria-label="Your courses">
    <div className="studio-board-tools">
      <div className="studio-switch" role="group" aria-label="Course view">
        <button type="button" aria-pressed={mode==='board'} onClick={()=>setMode('board')}><Columns3/>Board</button>
        <button type="button" aria-pressed={mode==='list'} onClick={()=>setMode('list')}><LayoutList/>List</button>
      </div>
      <span className="studio-result-count" role="status">{matches.length} {matches.length===1?'course':'courses'}</span>
      <div className="studio-tools-right">
        <button type="button" className="studio-plain-button" aria-controls="studio-filters" aria-expanded={showFilter} onClick={()=>setShowFilter(!showFilter)}>
          <SlidersHorizontal/> Filters{status!=='all'&&<span className="studio-filter-count">1</span>}</button>
        <button type="button" className="button" disabled={busy} onClick={onCreate}><Plus size={17}/> Add course</button>
      </div>
    </div>
    {showFilter&&<div className="studio-filter-bar" id="studio-filters">
      <label htmlFor="course-publication">Visibility</label>
      <select id="course-publication" value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="all">All courses</option><option value="published">Published</option><option value="draft">Draft</option></select>
      {status!=='all'&&<button type="button" onClick={()=>setStatus('all')}>Reset filter</button>}
      <button type="button" className="studio-icon-button" aria-label="Close filters" onClick={()=>setShowFilter(false)}><X/></button>
    </div>}
    {!matches.length?<div className="studio-empty"><SearchX size={27}/><h2>{courses.length?'No matching courses':'Your course board is empty'}</h2>
      <p>{courses.length?'Try another course name or change the visibility filter.':'Add your first course to start building its lessons.'}</p></div>:
    <div className={'studio-board'+(mode==='list'?' is-list':'')}>
      {lanes.map(lane=>{
        const cards=matches.filter(c=>subject(c)===lane.key);
        if((filtered||mode==='list')&&!cards.length)return null;
        return <section key={lane.key} className={'studio-lane lane-'+lane.key} aria-label={lane.name}>
          <header className="studio-lane-header"><span className="studio-lane-dot"/><h2>{lane.name}</h2><span className="studio-lane-count">{cards.length}</span></header>
          {!cards.length&&<p className="studio-lane-empty">No courses here yet</p>}
          {cards.map((c,index)=>{
            const total=c.lesson_count??0, videos=c.videos??0;
            const feature=Boolean(c.thumbnail_key||c.thumbnail_id)||(lane.key==='art'&&index===0);
            return <article key={c.id} className={'studio-course-card tone-'+lane.colours[index%lane.colours.length]}>
              <div className="studio-card-top"><div className="studio-tags"><span>{isConversion(c)?'Conversion':(c.level||'Course')}</span>
                {accredited(c)&&<span>CPD</span>}</div>{actions(c)}</div>
              <h3><button type="button" disabled={busy} aria-label={'Manage lessons for '+c.title} onClick={()=>onLessons(c.id)}>{c.title}</button></h3>
              {c.description&&<p className="studio-card-description">{courseSummary(c.description)}</p>}
              {feature&&<img className="studio-course-photo" src={courseImage(c,index,480)} width={440} height={200} alt="" loading="lazy"/>}
              {c.price!=null&&<p className="studio-card-fee"><span>Course fee</span><strong>{new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:0,maximumFractionDigits:2}).format(c.price/100)}</strong></p>}
              {total>0&&<div className="studio-video-coverage"><div><span>Video lessons</span><span>{videos} of {total}</span></div>
                <div className="studio-meter" aria-hidden="true"><span style={{width:Math.min(100,videos/total*100)+'%'}}/></div></div>}
              <footer><span className="studio-publish-state">{c.published?<Check size={14}/>:<span className="studio-draft-dot"/>}{c.published?'Published':'Draft'}</span>
                <span className="studio-card-stat" title={total+' lessons'}><BookOpen size={15}/><span>{total}</span><span className="sr-only"> lessons</span></span>
                <span className="studio-card-stat" title={videos+' videos'}><Video size={15}/><span>{videos}</span><span className="sr-only"> videos</span></span>
                <button type="button" disabled={busy} className="studio-card-open" aria-label={'Open '+c.title} title="Open lessons" onClick={()=>onLessons(c.id)}><ArrowUpRight size={16}/></button>
              </footer>
            </article>;
          })}
        </section>;
      })}
    </div>}
  </section>;
}
