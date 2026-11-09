'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function QualificationForm({courseId}:{courseId:string}){
  const router=useRouter(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  return <form className="form" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);
    try{const r=await fetch('/api/qualifications',{method:'POST',body:data});if(!r.ok)throw Error(((await r.json()) as {error:string}).error);
      setMessage('Qualification submitted for review.');router.refresh();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>
    <input type="hidden" name="courseId" value={courseId}/><input type="hidden" name="action" value="submit"/>
    <label>Proof of your nail qualification<input type="file" accept="image/jpeg,image/png,application/pdf" name="proof" required/></label><small>JPG, PNG or PDF, up to 2 MB.</small>
    <button className="button" disabled={busy}>{busy?'Submitting…':'Submit for review'}</button><p role="status">{message}</p></form>;
}
