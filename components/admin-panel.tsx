"use client";import EnquiryInbox from './enquiry-inbox';import {uploadLessonVideo} from "@/components/upload-lesson-video";import ReviewManager from '@/components/review-manager';import PaymentPanel from '@/components/payment-panel';import {useState,useEffect,useCallback,useRef} from 'react';
import {accredited} from '@/lib/data';
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
export default function AdminPanel({initialTab,initialCourse,displayName,email,canManageStaff}:{initialTab:string;initialCourse:string;displayName:string;email:string;canManageStaff:boolean}) {
  const [data,setData]=useState<any>({courses:[],lessons:[],enquiries:[],enrollments:[]});
  const [tab,setTab]=useState(initialTab), [selected,setSelected]=useState(initialCourse);
  const [editing,setEditing]=useState<any>(null), [busy,setBusy]=useState(false), [status,setStatus]=useState('');
  const [courseForm,setCourseForm]=useState(false);
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
  const createRequests=useRef(new WeakMap<HTMLFormElement,string>());
  const [loadedView,setLoadedView]=useState(''),[loadError,setLoadError]=useState('');
  const view=tab+':'+selected;
  const refresh=useCallback(async()=>{
    const ticket=++latest.current;
    try{
      const params=new URLSearchParams({tab});
      if(tab==='Lessons' && selected)params.set('courseId',selected);
      const response=await fetch('/api/admin?'+params,{cache:'no-store'});
      if(!response.ok)throw Error(response.status===403?'Your staff session needs attention.':'Academy data could not be loaded.');
      const result=await response.json() as {courses:StudioCourse[]};
      if(ticket===latest.current&&tab==='Lessons'&&selected&&!result.courses.some(c=>c.id===selected)){setSelected('');window.history.replaceState(null,'','/admin?tab=Lessons');return;}
      if(ticket===latest.current){setData(result);setLoadedView(tab+':'+selected);setLoadError('');}
    }catch(e){if(ticket===latest.current)setLoadError((e as Error).message);}
  },[tab,selected]);
  useEffect(()=>{setLoadError('');void refresh();return ()=>{latest.current++;};},[refresh]);
  function openTab(name:string, courseId=selected) {
    setSearch('');setTab(name); setEditing(null); setCourseForm(false);setStatus('');
    window.scrollTo({top:0});
    const params=new URLSearchParams({tab:name});
    if(name==='Lessons'&&courseId) params.set('courseId',courseId);
    window.history.replaceState(null,'','/admin?'+params);
  }
  function openLessons(id:string) {setSelected(id);openTab('Lessons',id);}
  async function submit(event:React.FormEvent<HTMLFormElement>,action:string) {
    event.preventDefault();
    const form=event.currentTarget, fields=new FormData(form);
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
        await uploadLessonVideo(fields,setStatus,Boolean(data.directVideoUpload));
      }
      const response=await fetch('/api/admin',{method:'POST',body:fields});
      const result=await response.json() as {error?:string;courseId?:string};
      if(!response.ok) throw Error(result.error||'Unable to save.');
      createRequests.current.delete(form);form.reset();setEditing(null);if(action==='course')setCourseForm(false);
      const newCourse=action==='course'&&!fields.get('id')&&result.courseId;
      if(newCourse)openLessons(result.courseId!);
      setStatus(action==='lesson'?'Lesson saved.':action==='course'?'Course saved.':'Saved successfully.');
      if(!newCourse)await refresh();
      return true;
    } catch(reason) {setStatus((reason as Error).message||'Unable to save. Please retry.');return false;}
    finally {setBusy(false);}
  }
  function createFirstCourse(){
    openTab('Courses');setCourseForm(true);
  }
  function editCourse(course:any=null){
    if(tab!=='Courses')openTab('Courses');
    setEditing(course);setCourseForm(true);setStatus('');
    heading.current?.focus();window.scrollTo({top:0});
  }
  const isEditor=tab==='Courses'&&courseForm;
  const section=sections[tab]||sections.Courses;
  const isBoard=!isEditor&&(tab==='Courses'||(tab==='Lessons'&&!selected));
  const board=<WorkspaceLibrary courses={data.courses} search={search} busy={busy} onLessons={openLessons} onCreate={createFirstCourse}
    onEdit={editCourse} onVisibility={e=>void submit(e,'visibility')}/>;
  const totals=<dl className="studio-metrics" aria-label="Academy totals">
        {[{label:'Gross sales',value:data.metrics?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(data.metrics.gross/100):'—',Icon:Banknote},
          {label:'Paid orders',value:data.metrics?.sales??'—',Icon:ReceiptText},
          {label:'Paying customers',value:data.metrics?.customers??'—',Icon:UsersRound}].map(({label,value,Icon})=><div key={label}><dt><Icon size={19} aria-hidden="true"/>{label}</dt><dd>{value}</dd></div>)}
      </dl>;
  return <div className={'studio-workspace'+(compact?' rail-compact':'')}>
    <WorkspaceNavigation tab={tab} onSelect={openTab} busy={busy} displayName={displayName} email={email} canManageStaff={canManageStaff}
      compact={compact} onCollapse={()=>setCompact(!compact)}/>
    <div className="studio-surface">
      <div className="studio-topbar">
        <div className="studio-welcome"><span>Welcome back,</span><strong>{displayName||(canManageStaff?'Academy owner':'Educator')}</strong></div>
        {isBoard?<label className="studio-search"><Search size={18} aria-hidden="true"/>
          <input ref={searchInput} type="search" aria-label="Find a course" placeholder="Search your courses…" value={search} onChange={e=>setSearch(e.target.value)}/>
          {search?<button type="button" aria-label="Clear search" onClick={()=>{setSearch('');searchInput.current?.focus();}}><X size={16}/></button>:<kbd>Ctrl / ⌘ K</kbd>}</label>:
          <div className="studio-crumb"><BookOpen size={17}/>Workspace <ChevronRight size={15}/><strong>{tab}</strong></div>}
        <a className="studio-site-link" href="/courses">View catalogue <ArrowUpRight size={16}/></a>
      </div>
    <section className="studio-main">
      {tab==='Lessons'&&selected&&<button type="button" className="studio-back" disabled={busy} onClick={()=>openLessons('')}><ArrowLeft size={17}/> All courses</button>}
      {isEditor&&<button type="button" className="studio-back" disabled={busy} onClick={()=>{setCourseForm(false);setEditing(null);setStatus('');}}><ArrowLeft size={17}/> Course library</button>}
      <header className="studio-heading"><div>
        <h1 ref={heading} tabIndex={-1}>{isBoard?(tab==='Lessons'?'Lesson board':'Course board'):isEditor?(editing?'Edit course':'Create a course'):section.title}</h1>
        {!isEditor&&<p>{isBoard?'Open a course to manage its lessons, videos and quizzes.':tab==='Lessons'?'Manage lesson order, recordings and knowledge checks for this course.':section.description}</p>}
      </div></header>
      {tab==='Payments'&&totals}
      {tab!=='Lessons'&&<p role="status" className="status-message">{status}</p>}{loadError&&<div className="notice" role="alert">{loadError} <button className="underlink" onClick={()=>void refresh()}>Try again</button>{' '}<a href="/admin/login" target="_blank" rel="noreferrer">Staff sign-in</a></div>}{loadedView!==view?<p role="status">{loadError?'':'Loading workspace…'}</p>:<>{tab==='Shop'&&<ShopManager onChange={refresh}/>}{tab==='Enquiries'&&<EnquiryInbox enquiries={data.enquiries||[]}/>}{tab==='Payments'&&<PaymentPanel onChange={refresh}/>}{tab==='Reviews'&&<ReviewManager/>}{tab==='Courses'&&!isEditor&&<>
        {board}
        {data.sumupReady===false&&<p className="studio-connection"><a href="/admin?tab=Payments">Connect SumUp <ArrowUpRight size={16}/></a> to start taking card payments.</p>}
      </>}
      {isEditor&&<section className="admin-section studio-course-form"><form key={editing?.id||'new'} className="form" onSubmit={e=>submit(e,'course')}><input type="hidden" name="id" value={editing?.id||''}/><label>Course title<input name="title" required maxLength={120} defaultValue={editing?.title||''}/></label><label>Description<textarea name="description" required maxLength={2000} defaultValue={editing?.description||''}/></label><label>What students will learn<textarea name="outcomes" maxLength={3000} rows={4} placeholder="One learning outcome per line" defaultValue={editing?.outcomes||''}/></label><label>Entry requirements & equipment<textarea name="requirements" maxLength={3000} rows={4} placeholder="Previous training, products and equipment needed" defaultValue={editing?.requirements||''}/></label><label>Duration<input name="duration" maxLength={200} placeholder="Confirmed course or study duration" defaultValue={editing?.duration||''}/></label><label>Access & support<textarea name="accessPolicy" maxLength={1000} placeholder="How long students have access and what support is included" defaultValue={editing?.access_policy||''}/></label><label>CPD accreditation<select name="cpd" defaultValue={editing&&accredited(editing)?'1':'0'}><option value="0">Unlisted</option><option value="1">CPD accredited</option></select></label><label>Level<select name="level" defaultValue={editing?.level||'Beginner'}><option>Beginner</option><option>Intermediate</option><option>Conversion</option><option>Creative</option></select></label><label>Price in GBP<input name="price" type="number" min="0" max="10000" step="0.01" defaultValue={editing?.price!=null?editing.price/100:''}/></label><fieldset className="course-delivery"><legend>Course access & thumbnail</legend><p>Add recordings in Lessons. Verified students watch from their academy account.</p><label>Course thumbnail (JPG, PNG or WebP, up to 3 MB)<input name="courseThumbnail" type="file" accept="image/jpeg,image/png,image/webp"/></label>{editing?.thumbnail_key&&<><img className="course-admin-preview" src={'/api/course-thumbnail/'+editing.id} alt="Current course thumbnail"/><label>Existing thumbnail<select name="removeCourseThumbnail"><option value="0">Keep or replace</option><option value="1">Remove</option></select></label></>}</fieldset><label>Visibility<select name="published" defaultValue={String(editing?.published||0)}><option value="0">Draft</option><option value="1">Published</option></select></label><button className="button" disabled={busy}>{editing?'Save changes':'Save course & add lessons'}</button><button type="button" disabled={busy} className="button outline" onClick={()=>{setCourseForm(false);setEditing(null);}}>Cancel editing</button></form></section>}
      {tab==='Lessons'&&!data.courses.some((c:{id:string})=>c.id===selected)&&board}
      {tab==='Lessons'&&data.courses.some((c:{id:string})=>c.id===selected)&&<CourseLessons key={selected} selected={selected} status={status} onSelect={openLessons} courses={data.courses} lessons={data.lessons||[]} busy={busy} save={submit} directUpload={data.directVideoUpload}/>}{tab==='Students'&&<><QualificationReviews/><div className="admin-grid"><div className="admin-section"><h2>Student payments</h2><p>SumUp confirms card payments automatically. Open a paid order to find the student’s private course link.</p><a className="button" href="/admin?tab=Payments">Open payments</a></div><div className="admin-section"><h2>Active enrolments</h2>{data.enrollments.length?data.enrollments.map((e:any)=><div className="row" key={e.id}><div><strong>{e.email}</strong><p>{e.title} · {e.completed}/{e.total} lessons complete</p></div><form onSubmit={event=>{if(!window.confirm('Remove course access for '+e.email+'?')){event.preventDefault();return}void submit(event,'revoke')}}><input type="hidden" name="id" value={e.id}/><button className="button outline" disabled={busy}>Revoke access</button></form></div>):<p>No active enrolments yet.</p>}</div></div></>}</>}
      {tab==='Courses'&&!isEditor&&totals}
    </section></div></div>;}
