'use client';

import {useEffect, useRef, useState, type FormEvent, type KeyboardEvent} from 'react';
import {ArrowRight, BookOpen, Check, ChevronDown, Eye, ImagePlus, Layers3, NotebookPen, Upload, Wallet, X} from 'lucide-react';
import {accredited, courseFee, courseSummary, isConversion, type Course} from '@/lib/data';
import {courseImage} from './ui';
import './course-editor.css';

const panels = [
  {id:'details', label:'Details', heading:'Course details', icon:NotebookPen},
  {id:'plan', label:'Learning plan', heading:'Learning plan', icon:Layers3},
  {id:'publishing', label:'Publishing', heading:'Pricing & visibility', icon:Wallet},
] as const;
type Panel = typeof panels[number]['id'];
type Props = {
  course:Course|null;
  busy:boolean;
  status:string;
  onSave:(event:FormEvent<HTMLFormElement>)=>Promise<boolean>;
  onCancel:()=>void;
};
const imageTypes = ['image/jpeg','image/png','image/webp'];

export default function CourseEditor({course,busy,status,onSave,onCancel}:Props) {
  const [panel,setPanel] = useState<Panel>('details');
  const [title,setTitle] = useState(course?.title||'');
  const [description,setDescription] = useState(course?.description||'');
  const [level,setLevel] = useState(course?.level||'Beginner');
  const [cpd,setCpd] = useState(course&&accredited(course)?'1':'0');
  const [price,setPrice] = useState(course?.price!=null?String(course.price/100):'');
  const [published,setPublished] = useState(Boolean(course?.published));
  const [file,setFile] = useState<File|null>(null);
  const [imageUrl,setImageUrl] = useState('');
  const [removed,setRemoved] = useState(false);
  const [coverError,setCoverError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const tabBar = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!file){setImageUrl('');return;}
    const url=URL.createObjectURL(file);
    setImageUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[file]);

  const existingCover=Boolean(course?.thumbnail_key)&&!removed;
  const fallbackCourse={id:course?.id||'',title,description,level,price:null,thumbnail_key:existingCover?course?.thumbnail_key:null,thumbnail_id:course?.thumbnail_id};
  const cover=imageUrl||courseImage(fallbackCourse,0,480);
  const previewLevel=isConversion(fallbackCourse)?'Conversion':level;

  function selectCover(input:HTMLInputElement) {
    const chosen=input.files?.[0]||null;
    const error=chosen&&(chosen.size>3*1024*1024||!imageTypes.includes(chosen.type))
      ?'Choose a JPG, PNG or WebP image up to 3 MB.':'';
    setFile(error?null:chosen);
    setCoverError(error);
    input.setCustomValidity(error);
  }
  function clearCover() {
    if(file||coverError){
      if(fileInput.current){fileInput.current.value='';fileInput.current.setCustomValidity('');}
      setFile(null);setCoverError('');
    } else {
      setRemoved(!removed);
    }
  }

  function moveTab(event:KeyboardEvent<HTMLButtonElement>,index:number) {
    const last=panels.length-1;
    const next=event.key==='ArrowRight'?(index+1)%panels.length:event.key==='ArrowLeft'?(index+last)%panels.length:
      event.key==='Home'?0:event.key==='End'?last:null;
    if(next===null)return;
    event.preventDefault();setPanel(panels[next].id);
    tabBar.current?.querySelectorAll('button')[next]?.focus();
  }

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    const form=event.currentTarget;
    for(const field of form.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input[required],textarea[required]')){
      field.setCustomValidity(field.value.trim()?'':'Please fill in this field.');
    }
    const invalid=form.querySelector('input:invalid,textarea:invalid,select:invalid');
    if(invalid instanceof HTMLInputElement||invalid instanceof HTMLTextAreaElement||invalid instanceof HTMLSelectElement){
      const group=invalid.closest<HTMLElement>('[data-editor-panel]')?.dataset.editorPanel as Panel|undefined;
      if(group)setPanel(group);
      requestAnimationFrame(()=>{invalid.focus();invalid.reportValidity();});
      return;
    }
    await onSave(event);
  }

  return <form className="course-editor" aria-busy={busy} aria-label={course?'Edit course':'Create a course'} noValidate onSubmit={submit}>
    <input type="hidden" name="id" value={course?.id||''}/>
    <input type="hidden" name="removeCourseThumbnail" value={removed?'1':'0'}/>
    <div className="ce-main" inert={busy}>
      <div className="ce-tabbar" ref={tabBar} role="tablist" aria-label="Course settings">
        {panels.map(({id,label,icon:Icon},index)=><button type="button" role="tab" key={id} id={'ce-tab-'+id} aria-controls={'ce-'+id}
          aria-selected={panel===id} tabIndex={panel===id?0:-1} onKeyDown={e=>moveTab(e,index)} onClick={()=>setPanel(id)}>
          <Icon size={17} aria-hidden="true"/>{label}</button>)}
      </div>
      {panels.map(({id,heading,icon:Icon})=><section key={id} role="tabpanel" id={'ce-'+id} aria-labelledby={'ce-tab-'+id}
        className={'ce-panel ce-'+id} data-editor-panel={id} hidden={panel!==id}>
        <div className="ce-panel-header"><span className="ce-section-icon"><Icon size={21} aria-hidden="true"/></span><h2>{heading}</h2></div>
        <div className="ce-fields">
        {id==='details'&&<>
          <label htmlFor="ce-title">Course title <span className="ce-required" aria-hidden="true">*</span>
            <input id="ce-title" name="title" required maxLength={120} value={title} placeholder="e.g. Gel Polish Foundations"
              onChange={e=>{e.target.setCustomValidity('');setTitle(e.target.value);}}/></label>
          <label htmlFor="ce-description">Description <span className="ce-required" aria-hidden="true">*</span>
            <textarea id="ce-description" name="description" required maxLength={2000} rows={4} value={description}
              placeholder="What will students learn on this course?" onChange={e=>{e.target.setCustomValidity('');setDescription(e.target.value);}}/></label>
          <div className="ce-pair">
            <label>Level<span className="ce-select"><select name="level" value={level} onChange={e=>setLevel(e.target.value)}>
              <option>Beginner</option><option>Intermediate</option><option>Conversion</option><option>Creative</option></select><ChevronDown/></span></label>
            <label>CPD accreditation<span className="ce-select"><select name="cpd" value={cpd} onChange={e=>setCpd(e.target.value)}>
              <option value="0">Unlisted</option><option value="1">CPD accredited</option></select><ChevronDown/></span></label>
          </div>
        </>}
        {id==='plan'&&<>
          <label>Course format<select name="format" defaultValue={course?.format||'classroom'}><option value="classroom">In person at the academy</option><option value="online">Online · coming soon</option></select></label>
          <label>Class dates and joining instructions<textarea name="classDates" rows={4} maxLength={3000} defaultValue={course?.class_dates||''} placeholder="Available dates, class times, venue and how to confirm a place"/></label>
          <small>Paid classroom students can read these details in their booking. Update them here as dates change.</small>
          <label>What students will learn<textarea name="outcomes" rows={3} maxLength={3000} defaultValue={course?.outcomes||''} placeholder="One learning outcome per line"/></label>
          <label>Entry requirements &amp; equipment<textarea name="requirements" rows={3} maxLength={3000} defaultValue={course?.requirements||''} placeholder="List any qualifications and kit students need"/></label>
          <label>Duration<input name="duration" maxLength={200} defaultValue={course?.duration||''} placeholder="e.g. 1 day at the salon"/></label>
          <label>Access &amp; support<textarea name="accessPolicy" rows={3} maxLength={1000} defaultValue={course?.access_policy||''} placeholder="How long can students access lessons and ask for help?"/></label>
        </>}
        {id==='publishing'&&<>
          <label htmlFor="ce-price">Course fee<span className="ce-currency"><span aria-hidden="true">£</span>
            <input id="ce-price" name="price" aria-label="Price in GBP" type="number" inputMode="decimal" min="0" max="10000" step="0.01" placeholder="0.00" value={price} onChange={e=>setPrice(e.target.value)}/>
            <span>GBP</span></span></label>
          <fieldset className="ce-visibility"><legend>Visibility</legend>
            {[{value:'0',label:'Draft',detail:'Only visible to academy staff.'},{value:'1',label:'Published',detail:'Listed in the student course catalogue.'}].map(({value,label,detail})=>
              <label key={value} className={'ce-choice'+(published===(value==='1')?' is-selected':'')}>
                <input type="radio" name="published" value={value} checked={published===(value==='1')} onChange={()=>setPublished(value==='1')}/>
                <span><strong>{label}</strong><small>{detail}</small></span></label>)}
          </fieldset>
        </>}
        </div>
      </section>)}
    </div>
    <aside className="ce-preview" aria-labelledby="ce-preview-heading">
      <header className="ce-preview-header"><Eye size={19} aria-hidden="true"/><h2 id="ce-preview-heading">Course preview</h2></header>
      <div className="ce-preview-card">
        <div className="ce-photo"><img src={cover} alt="Course cover preview" width={480} height={270}/>
          <span className="ce-badge">{published?<Check size={13}/>:<span className="ce-dot"/>}{published?'Published':'Draft'}</span></div>
        <div className="ce-preview-body"><div className="ce-tags"><span><BookOpen size={13}/>{previewLevel}</span>{cpd==='1'&&<span>CPD accredited</span>}</div>
          <h3>{title.trim()||'Untitled course'}</h3>
          {description.trim()&&<p className="ce-preview-description">{courseSummary(description)}</p>}
          <div className="ce-preview-fee"><span>Course fee</span><strong>{price!==''&&Number.isFinite(Number(price))?courseFee(Math.round(Number(price)*100)):'Not set'}</strong></div>
        </div>
      </div>
      <div className="ce-cover-controls" inert={busy}><label className="ce-upload"><ImagePlus size={17} aria-hidden="true"/>{file||existingCover?'Change cover':'Upload cover'}
        <input type="file" name="courseThumbnail" aria-label="Course cover image" accept="image/jpeg,image/png,image/webp"
          ref={fileInput} onChange={e=>selectCover(e.currentTarget)} aria-describedby="ce-cover-help"/></label>
        {(file||coverError||course?.thumbnail_key)&&<button type="button" className="ce-clear-cover" onClick={clearCover}>
          {removed&&!file&&!coverError?<Upload size={14}/>:<X size={14}/>}
          {file||coverError?'Clear selection':removed?'Restore cover':'Remove cover'}</button>}
        <p id="ce-cover-help" role={coverError?'alert':undefined}>{coverError||'JPG, PNG or WebP · up to 3 MB'}</p>
      </div>
    </aside>
      <div className="ce-actions">
        {status&&<p className="ce-error" role="alert">{status}</p>}
        <button type="button" className="ce-cancel" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="submit" className="button ce-save" disabled={busy}>{busy?'Saving…':course?'Save changes':published?'Publish & add lessons':'Save draft & add lessons'}<ArrowRight size={17} aria-hidden="true"/></button>
      </div>
  </form>;
}
