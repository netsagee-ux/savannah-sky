'use client';

import { useState } from 'react';
import { studentCoursePath } from '@/lib/student-course-link';

export default function WhatsAppCourseReply({id, title, email}: {id: string; title: string; email:string}) {
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);

  async function prepareReply() {
    const url = new URL(studentCoursePath(id), window.location.origin);
    let password:string|null;
    try {
      const response=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'course-password',id})});
      if(!response.ok)throw Error();
      password=((await response.json()) as {password:string|null}).password;
    } catch {setCopied(false);setReply('Unable to load the course details. Please retry.');return;}
    const text = 'Your payment for ' + title + ' is confirmed. Open your course here: ' + url.href +
      '\nStudent login: ' + email + (password?'\nOne-time course password: '+password+'\nVerify your order email, then enter this password to unlock the lessons.':'\nSign in to open your lessons.');
    setReply(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return <div className="form">
    <button type="button" className="button outline" onClick={prepareReply}>Copy WhatsApp reply</button>
    {reply && <><label>Reply for the buyer’s original WhatsApp chat<textarea readOnly value={reply} rows={3}
      onFocus={event => event.currentTarget.select()} /></label>
      <small role="status">{copied ? 'Copied. Paste this reply into the buyer’s chat.' : 'Select the reply and copy it into the buyer’s chat.'}</small></>}
  </div>;
}
