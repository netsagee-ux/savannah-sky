'use client';

import {useRef,useState,type FormEvent} from 'react';

export default function ContactForm({course='',topic}:{course?:string;topic?:string}) {
  const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  const sending=useRef(false);
  const attempt=useRef<{payload:string;id:string}|null>(null);
  const interest=topic==='instalments'?'Payment plans':topic==='dates'?'Class dates':course?'Course availability':'Choosing a course';
  const prompt=topic==='instalments'?'Could you let me know whether a payment plan is available for '+(course||'this course')+'?':
    topic==='dates'?'I’ve booked '+(course||'a classroom course')+' and would like to arrange my class date. My preferred date is ':
    course?'I’m interested in '+course+'. When can I enrol?':'';

  async function send(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(sending.current)return;
    const form=event.currentTarget,fields=Object.fromEntries(new FormData(form));
    const payload=JSON.stringify(fields);
    if(attempt.current?.payload!==payload)attempt.current={payload,id:crypto.randomUUID()};
    sending.current=true;setBusy(true);setStatus('');
    try {
      const result=await fetch('/api/enquiry',{method:'POST',signal:AbortSignal.timeout?.(30000),
        headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,requestId:attempt.current.id})});
      if(!result.ok)throw Error();
      attempt.current=null;form.reset();
      setStatus('Thank you. Your enquiry has been saved for the academy to review.');
    } catch {
      setStatus('We couldn’t confirm your enquiry. Your message is still here. Please try again.');
    } finally {
      sending.current=false;setBusy(false);
    }
  }
  return <form className="form" onSubmit={send}>
    <div className="form-two">
      <label>Your name<input name="name" required readOnly={busy} maxLength={100} placeholder="First and last name" autoComplete="name"/></label>
      <label>Email address<input name="email" type="email" required readOnly={busy} maxLength={200} placeholder="you@example.com" autoComplete="email"/></label>
    </div>
    <label>What would you like to know?<select name="interest" disabled={busy} defaultValue={interest}>
      {['Choosing a course','Course availability','Payment plans','Class dates','Student support','Something else'].map(value=><option key={value}>{value}</option>)}
    </select></label>
    <label>Your message<textarea name="message" defaultValue={prompt} required readOnly={busy} minLength={10} maxLength={3000} rows={5} placeholder="Tell us a little about how we can help…"/></label>
    <p className="quiet">Your details are used to respond to your enquiry and are visible only to academy management.</p>
    <button className="button" disabled={busy} aria-busy={busy}>{busy?'Sending…':'Send your enquiry'}</button>
    <p role="status" className="status-message">{status}</p>
  </form>;
}
