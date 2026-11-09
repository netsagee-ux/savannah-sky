'use client';
import {useState} from 'react';

export default function CheckoutButton({courseId}:{courseId:string}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function start(){
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseId})});
      if(response.status===401){location.assign('/sign-in?redirect_url='+encodeURIComponent('/courses/'+courseId+'#enrol'));return;}
      const result=await response.json() as {path?:string;error?:string};
      if(!response.ok||!result.path)throw Error(result.error||'Please try again.');
      location.assign(result.path);
    } catch(e){setError((e as Error).message);setBusy(false);}
  }
  return <><button className="button" type="button" disabled={busy} onClick={start}>{busy?'Opening checkout…':'Continue to payment'}</button>{error&&<p role="alert">{error}</p>}</>;
}
