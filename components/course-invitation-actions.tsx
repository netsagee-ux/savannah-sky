'use client';

import { useState } from 'react';

export default function CourseInvitationActions({id, title, email, classroom=false}: {classroom?:boolean;id: string; title: string; email:string}) {
  const [reply, setReply] = useState('');
  const [available,setAvailable]=useState(false);
  const [copied, setCopied] = useState(false);

  async function prepareReply() {
    let url:URL;
    let password:string|null;
    try {
      const response=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'course-password',id})});
      if(!response.ok)throw Error();
      const details=await response.json() as {password:string|null;path:string};
      password=details.password;
      url=new URL(details.path,window.location.origin);
    } catch {setAvailable(false);setCopied(false);setReply('Unable to load the course details. Please retry.');return;}
    const text = 'Your payment for ' + title + (' is confirmed. '+(classroom?'View your in-person booking and available dates here: ':'Open your course here: ')) + url.href +
      '\nStudent login: ' + email + (password?'\nOne-time course password: '+password+'\nVerify your order email, then enter this password to unlock the lessons.':classroom?'\nSign in to see joining details and arrange your date with Carla.':'\nSign in to open your lessons.');
    setAvailable(true);setReply(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return <div className="form">
    <button type="button" className="button outline" onClick={prepareReply}>{classroom?'Copy private booking link':'Copy private course link and sign-in details'}</button>
    {available && <a className="underlink" href={'mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent('Your '+title+' course')+'&body='+encodeURIComponent(reply)}>Open email draft for buyer</a>}
    {reply && <><label>Message for the buyer<textarea readOnly value={reply} rows={3}
      onFocus={event => event.currentTarget.select()} /></label>
      <small role="status">{copied ? 'Copied. Send these details to the buyer.' : 'Select the message to copy it.'}</small></>}
  </div>;
}
