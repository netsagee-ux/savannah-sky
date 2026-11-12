'use client';

import {useRef,useState} from 'react';

export default function CourseInvitationActions({id,title,email,classroom=false}: {id:string;title:string;email:string;classroom?:boolean}) {
  const [reply,setReply]=useState(''),[error,setError]=useState('');
  const [copied,setCopied]=useState(false),[busy,setBusy]=useState(false);
  const preparing=useRef(false);

  async function prepareReply() {
    if(preparing.current)return;
    preparing.current=true;setBusy(true);setError('');setCopied(false);setReply('');
    try {
      const response=await fetch('/api/payments',{method:'POST',signal:AbortSignal.timeout?.(30000),
        headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'course-password',id})});
      if(!response.ok)throw Error();
      const details=await response.json() as {password:string|null;path:string};
      const url=new URL(details.path,window.location.origin);
      const intro=classroom?'View your in-person booking and available dates here: ':'Open your course here: ';
      const instructions=details.password?'One-time course password: '+details.password+'\nVerify your order email, then enter this password to unlock the lessons.':
        classroom?'Sign in to see joining details and arrange your date with Carla.':'Sign in to open your lessons.';
      const text='Your payment for '+title+' is confirmed. '+intro+url.href+'\nStudent login: '+email+'\n'+instructions;
      setReply(text);
      try {await navigator.clipboard.writeText(text);setCopied(true);} catch { /* The selectable message is available below. */ }
    } catch {
      setError('Unable to load the course details. Please try again.');
    } finally {
      preparing.current=false;setBusy(false);
    }
  }
  return <div className="form">
    <button type="button" className="button outline" onClick={prepareReply} disabled={busy} aria-busy={busy}>
      {busy?'Preparing private link…':classroom?'Copy private booking link':'Copy private course link and sign-in details'}
    </button>
    {error&&<p role="alert">{error}</p>}
    {reply&&<><a className="underlink" href={'mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent('Your '+title+' course')+'&body='+encodeURIComponent(reply)}>Open email draft for buyer</a>
      <label>Message for the buyer<textarea readOnly value={reply} rows={3} onFocus={event=>event.currentTarget.select()}/></label>
      <small role="status">{copied?'Copied. Send these details to the buyer.':'Select the message to copy it.'}</small></>}
  </div>;
}
