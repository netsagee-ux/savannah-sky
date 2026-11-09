'use client';
import {useState,useEffect,useCallback} from 'react';
type Review={id:string;email:string;course:string};
export default function QualificationReviews(){
  const [rows,setRows]=useState<Review[]|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{try{const r=await fetch('/api/qualifications',{cache:'no-store'});if(!r.ok)throw Error();setRows((await r.json() as {requests:Review[]}).requests);}catch{setMessage('Could not load qualification requests.');}},[]);
  useEffect(()=>{void load();},[load]);
  async function review(id:string,action:string){
    setBusy(true);const f=new FormData();f.set('id',id);f.set('action',action);
    try{const r=await fetch('/api/qualifications',{method:'POST',body:f});if(!r.ok)throw Error('Could not save the review.');setMessage('Review saved.');await load();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="admin-section"><h2>Conversion qualifications</h2>
    {rows?.map(q=><article className="shop-admin-order" key={q.id}><strong>{q.email}</strong><p>{q.course}</p><a className="underlink" href={'/api/qualifications?id='+q.id}>Download qualification</a><div className="quiz-actions">
      <button className="button" disabled={busy} onClick={()=>review(q.id,'approve')}>Approve qualification</button><button className="button outline" disabled={busy} onClick={()=>review(q.id,'resubmit')}>Request another copy</button></div></article>)}
    {rows?.length===0&&<p>No qualifications awaiting review.</p>}<p role="status">{message}</p>{rows===null&&<button className="underlink" onClick={load}>Refresh requests</button>}</section>;
}
