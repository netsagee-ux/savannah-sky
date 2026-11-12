"use client";import EnquiryInbox from './enquiry-inbox';import {StaffSessionError,uploadLessonVideo} from "@/components/upload-lesson-video";import ReviewManager from '@/components/review-manager';import PaymentPanel from '@/components/payment-panel';import {useState,useEffect,useCallback,useRef} from 'react';
import {stageLessonPhotos} from './lesson-photos';
import {courseEditPath} from '@/lib/staff-navigation';
import CourseEditor from './course-editor';
import OwnerHandover from './owner-handover';
import QualificationReviews from './qualification-reviews';
import ShopManager from './shop-manager';
import WorkspaceNavigation from './workspace-navigation';
import WorkspaceLibrary, {type StudioCourse} from './workspace-library';
import {ArrowLeft,ArrowUpRight,Banknote,BookOpen,ChevronRight,ReceiptText,Search,UsersRound,X} from 'lucide-react';
import CourseLessons from './course-lessons';
const sections:Record<string,{title:string;description:string}>={
  Courses:{title:'Course library',description:'Manage your courses, lessons and publishing.'},
  Lessons:{title:'Lesson studio',description:'Choose a course to edit its videos, notes and knowledge checks.'},
  Students:{title:'Students',description:'Review qualifications and manage access to training.'},
  Enquiries:{title:'Enquiries',description:'Read messages sent to the academy.'},
  Reviews:{title:'Reviews',description:'Manage feedback shown on the academy website.'},
  Payments:{title:'Payments',description:'Manage your SumUp connection, orders and course receipts.'},
  Shop:{title:'Academy shop',description:'Manage products, delivery and customer orders.'},
};
export default function AdminPanel({initialTab,initialCourse,startCreating,displayName,email,handover}:{handover:'complete'|'temporary'|'ready';initialTab:string;initialCourse:string;startCreating:boolean;displayName:string;email:string}) {
  const [data,setData]=useState<any>({courses:[],lessons:[],enquiries:[],enrollments:[]});
  const [tab,setTab]=useState(initialTab), [selected,setSelected]=useState(initialTab==='Lessons'?initialCourse:'');
  const [editingId,setEditingId]=useState(initialTab==='Courses'?initialCourse:''), [busy,setBusy]=useState(false), [status,setStatus]=useState('');
  const [needsSignIn,setNeedsSignIn]=useState(false);
  const [courseForm,setCourseForm]=useState(startCreating||Boolean(editingId));
  const editing:StudioCourse|undefined=data.courses.find((course:StudioCourse)=>course.id===editingId);
  const heading=useRef<HTMLHeadingElement>(null);
  const searchInput=useRef<HTMLInputElement>(null);
  const [search,setSearch]=useState('');
  const [compact,setCompact]=useState(false);
  useEffect(()=>{
    const searchShortcut=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'&&searchInput.current){
        event.preventDefault();searchInput.current.focus();
      }
    };
    document.addEventListener('keydown',searchShortcut);
    return ()=>document.removeEventListener('keydown',searchShortcut);
  },[]);
  const latest=useRef(0);
  const saving=useRef(false);
  const createRequests=useRef(new WeakMap<HTMLFormElement,string>());
  const [loadedView,setLoadedView]=useState(''),[loadError,setLoadError]=useState('');
  const view=tab+':'+selected;
  const refresh=useCallback(async()=>{
    const ticket=++latest.current;
    try{
      const params=new URLSearchParams({tab});
      if(tab==='Lessons' && selected)params.set('courseId',selected);
      const response=await fetch('/api/admin?'+params,{cache:'no-store',signal:AbortSignal.timeout?.(30000)});
      if(response.status===401||response.status===403)throw new StaffSessionError();
      if(!response.ok)throw Error('Academy data could not be loaded.');
      const result=await response.json() as {courses:StudioCourse[]};
      if(ticket===latest.current&&tab==='Lessons'&&selected&&!result.courses.some(c=>c.id===selected)){setSelected('');window.history.replaceState(null,'','/admin?tab=Lessons');return;}
      if(ticket===latest.current){setData(result);setLoadedView(tab+':'+selected);setLoadError('');setNeedsSignIn(false);}
    }catch(e){if(ticket===latest.current){setLoadError((e as Error).name==='TimeoutError'?'The workspace took too long to load. Please try again.':(e as Error).message);setNeedsSignIn(e instanceof StaffSessionError);}}
  },[tab,selected]);
  useEffect(()=>{setLoadError('');void refresh();return ()=>{latest.current++;};},[refresh]);
  function openTab(name:string, courseId=selected) {
    setSearch('');setTab(name); setEditingId(''); setCourseForm(false);setStatus('');
    window.scrollTo({top:0});
    const params=new URLSearchParams({tab:name});
    if(name==='Lessons'&&courseId) params.set('courseId',courseId);
    window.history.replaceState(null,'','/admin?'+params);
  }
  function openLessons(id:string) {setSelected(id);openTab('Lessons',id);}
  async function submit(event:React.FormEvent<HTMLFormElement>,action:string) {
    event.preventDefault();
    if(saving.current)return false;
    const form=event.currentTarget, fields=new FormData(form);
    saving.current=true;
    setBusy(true);setStatus('');
    try {
      fields.set('action',action);
      if((action==='lesson'||action==='course')&&!fields.get('id')){
        const requestId=createRequests.current.get(form)??crypto.randomUUID();
        createRequests.current.set(form,requestId);
        fields.set('creationId',requestId);
      }
      if(action==='lesson'){
        const file=(form.elements.namedItem('video') as HTMLInputElement|null)?.files?.[0];
        if(file)fields.set('video',file);
        const photos=(form.elements.namedItem('privatePhotos') as HTMLInputElement|null)?.files;
        await stageLessonPhotos(fields,Array.from(photos||[]),setStatus);
        await uploadLessonVideo(fields,setStatus,Boolean(data.directVideoUpload));
      }
      const response=await fetch('/api/admin',{method:'POST',body:fields});
      const result=await response.json() as {error?:string;courseId?:string;code?:string};
      if(response.status===401||(response.status===403&&result.code!=='invalid_origin'))throw new StaffSessionError();
      if(result.code==='lesson_changed')await refresh();
      if(!response.ok) throw Error(result.error||'Unable to save.');
      setNeedsSignIn(false);createRequests.current.delete(form);form.reset();
      if(action==='course'){
        setEditingId('');setCourseForm(false);
        window.history.replaceState(null,'','/admin?tab=Courses');
      }
      const newCourse=action==='course'&&!fields.get('id')&&result.courseId;
      if(newCourse)openLessons(result.courseId!);
      setStatus(action==='linkLesson'?'Lesson added to this course.':action==='lesson'?'Lesson saved.':action==='course'?'Course saved.':'Saved successfully.');
      if(!newCourse)await refresh();
      return true;
    } catch(reason) {setNeedsSignIn(reason instanceof StaffSessionError);setStatus((reason as Error).message||'Unable to save. Please retry.');return false;}
    finally {saving.current=false;setBusy(false);}
  }
  function createFirstCourse(){
    openTab('Courses');setCourseForm(true);
    window.history.replaceState(null,'','/admin?tab=Courses&action=create');
  }
  function closeEditor(){openTab('Courses');}
  const returnParams=new URLSearchParams({tab});
  if(tab==='Lessons'&&selected)returnParams.set('courseId',selected);
  if(tab==='Courses'&&courseForm&&!editingId)returnParams.set('action','create');
  const signInUrl='/sign-in?redirect_url='+encodeURIComponent(tab==='Courses'&&courseForm&&editingId?courseEditPath(editingId):'/admin?'+returnParams);
  const isEditor=tab==='Courses'&&courseForm;
  const section=sections[tab]||sections.Courses;
  const isBoard=!isEditor&&(tab==='Courses'||(tab==='Lessons'&&!selected));
  const board=<WorkspaceLibrary courses={data.courses} search={search} busy={busy} onLessons={openLessons} onCreate={createFirstCourse}
    onVisibility={e=>void submit(e,'visibility')}/>;
  const totals=<dl className="studio-metrics" aria-label="Academy totals">
        {[{label:'Gross sales',value:data.metrics?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(data.metrics.gross/100):'—',Icon:Banknote},
          {label:'Paid orders',value:data.metrics?.sales??'—',Icon:ReceiptText},
          {label:'Paying customers',value:data.metrics?.customers??'—',Icon:UsersRound}].map(({label,value,Icon})=><div key={label}><dt><Icon size={19} aria-hidden="true"/>{label}</dt><dd>{value}</dd></div>)}
      </dl>;
  return <div className={'studio-workspace'+(compact?' rail-compact':'')}>
    <WorkspaceNavigation tab={tab} onSelect={openTab} busy={busy} displayName={displayName} email={email}
      compact={compact} onCollapse={()=>setCompact(!compact)}/>
    <div className="studio-surface">
      <div className="studio-topbar">
        <div className="studio-welcome"><span>Welcome back,</span><strong>{displayName||'Academy owner'}</strong></div>
        {isBoard?<label className="studio-search"><Search size={18} aria-hidden="true"/>
          <input ref={searchInput} type="search" aria-label="Find a course" placeholder="Search your courses…" value={search} onChange={e=>setSearch(e.target.value)}/>
          {search?<button type="button" aria-label="Clear search" onClick={()=>{setSearch('');searchInput.current?.focus();}}><X size={16}/></button>:<kbd>Ctrl / ⌘ K</kbd>}</label>:
          <div className="studio-crumb"><BookOpen size={17}/>Workspace <ChevronRight size={15}/><strong>{tab}</strong></div>}
        <a className="studio-site-link" href="/courses">View catalogue <ArrowUpRight size={16}/></a>
      </div>
    <section className="studio-main">
      {tab==='Lessons'&&selected&&<button type="button" className="studio-back" disabled={busy} onClick={()=>openLessons('')}><ArrowLeft size={17}/> All courses</button>}
      {isEditor&&<button type="button" className="studio-back" disabled={busy} onClick={closeEditor}><ArrowLeft size={17}/> Course library</button>}
      <header className="studio-heading"><div>
        <h1 ref={heading} tabIndex={-1}>{isBoard?(tab==='Lessons'?'Lesson board':'Course board'):isEditor?(editingId?'Edit course':'Create a course'):section.title}</h1>
        {!isEditor&&<p>{isBoard?'Open a course to manage its lessons, videos and quizzes.':tab==='Lessons'?'Manage lesson order, recordings and knowledge checks for this course.':section.description}</p>}
      </div></header>
      {needsSignIn&&<p className="notice"><a className="underlink" href={signInUrl} target="_blank" rel="noopener noreferrer">Sign in in a new tab</a>. Keep this workspace open to resume your work.</p>}
      {tab==='Payments'&&totals}
      {tab!=='Lessons'&&!isEditor&&<p role="status" className="status-message">{status}</p>}{loadError&&<div className="notice" role="alert">{loadError} <button className="underlink" onClick={()=>void refresh()}>Try again</button></div>}{loadedView!==view?<p role="status">{loadError?'':'Loading workspace…'}</p>:<>{tab==='Shop'&&<ShopManager onChange={refresh}/>}{tab==='Enquiries'&&<EnquiryInbox enquiries={data.enquiries||[]}/>}{tab==='Payments'&&<PaymentPanel onChange={refresh}/>}{tab==='Reviews'&&<ReviewManager/>}{tab==='Courses'&&!isEditor&&<>
        {board}
        {data.sumupReady===false&&<p className="studio-connection"><a href="/admin?tab=Payments">Connect SumUp <ArrowUpRight size={16}/></a> to start taking card payments.</p>}
      </>}
      {isEditor&&(editingId&&!editing?<p role="alert">This course could not be found. <button type="button" className="underlink" onClick={closeEditor}>Return to course library</button></p>:
        <CourseEditor key={editingId||'new'} course={editing||null} busy={busy} status={status}
          onSave={e=>submit(e,'course')} onCancel={closeEditor}/>)}
      {tab==='Lessons'&&!data.courses.some((c:{id:string})=>c.id===selected)&&board}
      {tab==='Lessons'&&data.courses.some((c:{id:string})=>c.id===selected)&&<CourseLessons key={selected} selected={selected} status={status} onSelect={openLessons} courses={data.courses} reusableLessons={data.reusableLessons||[]} lessons={data.lessons||[]} busy={busy} save={submit} directUpload={data.directVideoUpload}/>}{tab==='Students'&&<><QualificationReviews/><div className="admin-grid"><div className="admin-section"><h2>Student payments</h2><p>SumUp confirms card payments automatically. Open a paid order to find the student’s private course link.</p><a className="button" href="/admin?tab=Payments">Open payments</a></div><div className="admin-section"><h2>Active enrolments</h2>{data.enrollments.length?data.enrollments.map((e:any)=><div className="row" key={e.id}><div><strong>{e.email}</strong><p>{e.title} · {e.completed}/{e.total} lessons complete</p></div><form onSubmit={event=>{if(!window.confirm('Remove course access for '+e.email+'?')){event.preventDefault();return}void submit(event,'revoke')}}><input type="hidden" name="id" value={e.id}/><button className="button outline" disabled={busy}>Revoke access</button></form></div>):<p>No active enrolments yet.</p>}</div></div></>}</>}
      {tab==='Courses'&&!isEditor&&<>{totals}<OwnerHandover state={handover}/></>}
    </section></div></div>;}
