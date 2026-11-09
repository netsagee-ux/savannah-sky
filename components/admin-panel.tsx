"use client";import EnquiryInbox from './enquiry-inbox';import {uploadLessonVideo} from "@/components/upload-lesson-video";import ReviewManager from '@/components/review-manager';import PaymentPanel from '@/components/payment-panel';import {useState,useEffect,useCallback,useRef} from 'react';
import {accredited} from '@/lib/data';
import QualificationReviews from './qualification-reviews';
import ShopManager from './shop-manager';
import CourseLessons from './course-lessons';
export default function AdminPanel({initialTab,initialCourse}:{initialTab:string;initialCourse:string}) {
  const [data,setData]=useState<any>({courses:[],lessons:[],enquiries:[],enrollments:[]});
  const [tab,setTab]=useState(initialTab), [selected,setSelected]=useState(initialCourse);
  const [editing,setEditing]=useState<any>(null), [busy,setBusy]=useState(false), [status,setStatus]=useState('');
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
      const result=await response.json();
      if(ticket===latest.current){setData(result);setLoadedView(tab+':'+selected);setLoadError('');}
    }catch(e){if(ticket===latest.current)setLoadError((e as Error).message);}
  },[tab,selected]);
  useEffect(()=>{setLoadError('');void refresh();return ()=>{latest.current++;};},[refresh]);
  function openTab(name:string, courseId=selected) {
    setTab(name); setEditing(null); setStatus('');
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
      createRequests.current.delete(form);form.reset();setEditing(null);
      const newCourse=action==='course'&&!fields.get('id')&&result.courseId;
      if(newCourse)openLessons(result.courseId!);
      setStatus(action==='lesson'?'Lesson saved.':action==='course'?'Course saved.':'Saved successfully.');
      if(!newCourse)await refresh();
      return true;
    } catch(reason) {setStatus((reason as Error).message||'Unable to save. Please retry.');return false;}
    finally {setBusy(false);}
  }
  return <><div className="admin-metrics"><div><strong>{data.metrics?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(data.metrics.gross/100):'—'}</strong><span>Gross sales</span></div><div><strong>{data.metrics?.sales??'—'}</strong><span>Paid orders</span></div><div><strong>{data.metrics?.customers??'—'}</strong><span>Paying customers</span></div></div><div className="tabs" aria-label="Management sections" role="tablist">{['Courses','Lessons','Students','Enquiries','Reviews','Payments','Shop'].map(t=><button role="tab" aria-selected={tab===t} key={t} className={tab===t?'selected':''} disabled={busy} onClick={()=>openTab(t)}>{t}</button>)}</div>{tab!=='Lessons'&&<p role="status" className="status-message">{status}</p>}{loadError&&<div className="notice" role="alert">{loadError} <button className="underlink" onClick={()=>void refresh()}>Try again</button>{' '}<a href="/admin/login" target="_blank" rel="noreferrer">Staff sign-in</a></div>}{loadedView!==view?<p role="status">{loadError?'':'Loading workspace…'}</p>:<>{tab==='Shop'&&<ShopManager onChange={refresh}/>}{tab==='Enquiries'&&<EnquiryInbox enquiries={data.enquiries||[]}/>}{tab==='Payments'&&<PaymentPanel onChange={refresh}/>}{tab==='Reviews'&&<ReviewManager/>}{tab==='Courses'&&<div className="admin-grid"><div className="admin-section"><h2 id="course-form-heading">{editing?'Edit course':'Create a course'}</h2><form key={editing?.id||'new'} className="form" onSubmit={e=>submit(e,'course')}><input type="hidden" name="id" value={editing?.id||''}/><label>Course title<input name="title" required maxLength={120} defaultValue={editing?.title||''}/></label><label>Description<textarea name="description" required maxLength={2000} defaultValue={editing?.description||''}/></label><label>What students will learn<textarea name="outcomes" maxLength={3000} rows={4} placeholder="One learning outcome per line" defaultValue={editing?.outcomes||''}/></label><label>Entry requirements & equipment<textarea name="requirements" maxLength={3000} rows={4} placeholder="Previous training, products and equipment needed" defaultValue={editing?.requirements||''}/></label><label>Duration<input name="duration" maxLength={200} placeholder="Confirmed course or study duration" defaultValue={editing?.duration||''}/></label><label>Access & support<textarea name="accessPolicy" maxLength={1000} placeholder="How long students have access and what support is included" defaultValue={editing?.access_policy||''}/></label><label>CPD accreditation<select name="cpd" defaultValue={editing&&accredited(editing)?'1':'0'}><option value="0">Unlisted</option><option value="1">CPD accredited</option></select></label><label>Level<select name="level" defaultValue={editing?.level||'Beginner'}><option>Beginner</option><option>Intermediate</option><option>Conversion</option><option>Creative</option></select></label><label>Price in GBP<input name="price" type="number" min="0" max="10000" step="0.01" defaultValue={editing?.price!=null?editing.price/100:''}/></label><fieldset className="course-delivery"><legend>Course access & thumbnail</legend><p>Add recordings in Lessons. Verified students watch from their academy account.</p><label>Course thumbnail (JPG, PNG or WebP, up to 3 MB)<input name="courseThumbnail" type="file" accept="image/jpeg,image/png,image/webp"/></label>{editing?.thumbnail_key&&<><img className="course-admin-preview" src={'/api/course-thumbnail/'+editing.id} alt="Current course thumbnail"/><label>Existing thumbnail<select name="removeCourseThumbnail"><option value="0">Keep or replace</option><option value="1">Remove</option></select></label></>}</fieldset><label>Visibility<select name="published" defaultValue={String(editing?.published||0)}><option value="0">Draft</option><option value="1">Published</option></select></label><button className="button" disabled={busy}>{editing?'Save changes':'Save course & add lessons'}</button>{editing&&<button type="button" className="button outline" onClick={()=>setEditing(null)}>Cancel editing</button>}</form></div><div className="admin-section"><h2>Your courses</h2>{data.sumupReady===false&&<p className="notice">To receive orders, <a className="underlink" href="/admin?tab=Payments">connect your SumUp account</a>.</p>}{data.courses.length?data.courses.map((c:any)=><div className="row" key={c.id}><div><strong>{c.title}</strong><p>{c.published?'Published':'Draft'} · {c.price!=null?'£'+(c.price/100).toFixed(2):'No price'} · {c.videos??0} private videos</p><button className="button outline" type="button" disabled={busy} onClick={()=>openLessons(c.id)}>Manage lessons & videos</button><button className="edit-link" type="button" onClick={()=>{setEditing(c);setStatus('Editing '+c.title);document.getElementById('course-form-heading')?.scrollIntoView({block:'start'})}}>Edit details</button></div><form onSubmit={e=>submit(e,'visibility')}><input name="id" value={c.id} type="hidden"/><input name="published" value={c.published?'0':'1'} type="hidden"/><button className="button outline" disabled={busy}>{c.published?'Unpublish':'Publish'}</button></form></div>):<p>No courses yet. Create a draft to get started.</p>}</div></div>}{tab==='Lessons'&&<CourseLessons key={selected} selected={selected} status={status} onSelect={openLessons} courses={data.courses} lessons={data.lessons||[]} busy={busy} save={submit} directUpload={data.directVideoUpload}/>}{tab==='Students'&&<><QualificationReviews/><div className="admin-grid"><div className="admin-section"><h2>Student payments</h2><p>SumUp confirms card payments automatically. Open a paid order to find the student’s private course link.</p><a className="button" href="/admin?tab=Payments">Open payments</a></div><div className="admin-section"><h2>Active enrolments</h2>{data.enrollments.length?data.enrollments.map((e:any)=><div className="row" key={e.id}><div><strong>{e.email}</strong><p>{e.title} · {e.completed}/{e.total} lessons complete</p></div><form onSubmit={event=>{if(!window.confirm('Remove course access for '+e.email+'?')){event.preventDefault();return}void submit(event,'revoke')}}><input type="hidden" name="id" value={e.id}/><button className="button outline" disabled={busy}>Revoke access</button></form></div>):<p>No active enrolments yet.</p>}</div></div></>}</>}</>}