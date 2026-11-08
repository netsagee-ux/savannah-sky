'use client';
import {useState,type FormEvent} from 'react';

export default function ActivateCourse({id}:{id:string}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function activate(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password=new FormData(event.currentTarget).get('password');
    setBusy(true);setError('');
    try {
      const result=await fetch('/api/orders/'+encodeURIComponent(id)+'/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      if(!result.ok)throw Error(((await result.json()) as {error?:string}).error || 'Could not activate your course.');
      const {path}=await result.json() as {path:string};
      location.assign(path);
    } catch(reason){setError((reason as Error).message);setBusy(false);}
  }
  return <form onSubmit={activate} className="form"><label>One-time course password
    <input name="password" required maxLength={32} autoComplete="one-time-code" spellCheck={false} /></label>
    <button disabled={busy} className="button">{busy?'Opening…':'Activate my course'}</button>{error&&<p role="alert">{error}</p>}</form>;
}
