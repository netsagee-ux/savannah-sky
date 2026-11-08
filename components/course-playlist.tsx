import {Check, ChevronLeft, ChevronRight} from 'lucide-react';

export default function CoursePlaylist({title,courseId,list,index,children}:{
  title:string;courseId:string;list:{id:string;title:string;completed:number}[]; index:number;children:React.ReactNode;
}) {
  const url=(i:number)=>'/learn/'+encodeURIComponent(list[i].id);
  const toc=<ol>{list.map((item,i)=><li key={item.id}><a href={url(i)} aria-current={i===index?'page':undefined}>
    <span>{String(i+1).padStart(2,'0')}</span><span>{item.title}</span>{item.completed?<Check size={15} aria-label="Completed"/>:null}</a></li>)}</ol>;
  return <section className="lesson-desk"><header><a href="/dashboard" className="underlink"><ChevronLeft size={16}/> My learning</a><p>{title}</p></header>
    <div className="lesson-desk-grid"><aside className="desk-playlist" aria-label="Course navigation">
      <nav className="desktop-playlist" aria-label="Lesson list"><h2>Course lessons</h2>{toc}</nav>
      <details className="mobile-playlist"><summary>Course lessons <span>{index+1} / {list.length}</span></summary><nav aria-label="Lesson list">{toc}</nav></details>
    </aside><article className="desk-player"><p className="studio-kicker">Lesson {index+1} of {list.length}</p>{children}
      <nav className="lesson-pager" aria-label="Lesson navigation">
        {index>0&&<a className="underlink" href={url(index-1)}><ChevronLeft size={15}/>Previous lesson</a>}
        {index+1<list.length?<a className="button" href={url(index+1)}>Next lesson <ChevronRight size={15}/></a>:<a className="underlink" href={'/certificate/'+courseId}>Completion record</a>}
      </nav></article></div></section>;
}
