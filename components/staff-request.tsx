'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

export default function StaffRequest({id,current,email}:{id?:string;current?:string;email?:string}){
  const router=useRouter(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  async function send(action:string){
    if(action==='approve' && current && current!==email && !window.confirm('Replace staff access for '+current+' with '+email+'?'))return;
    setBusy(true);setNotice('');
    try{
      const response=await fetch('/api/staff-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,request:id,current})});
      const result=await response.json() as {message?:string;error?:string};
      if(!response.ok)throw Error(result.error||'Please try again.');
      setNotice(result.message||'Saved.');router.refresh();
    }catch(e){setNotice((e as Error).message);}
    finally{setBusy(false);}
  }
  return <div>{id?<><button className="button" disabled={busy} onClick={()=>send('approve')}>Approve</button>{' '}
    <button className="underlink" disabled={busy} onClick={()=>send('dismiss')}>Dismiss</button></>:
    <button className="button" disabled={busy} onClick={()=>send('request')}>Request staff access</button>}
    <p role="status">{notice}</p></div>;
}
