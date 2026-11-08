'use client';

import { useState } from 'react';
import { studentCoursePath } from '@/lib/student-course-link';

export default function WhatsAppCourseReply({id, title}: {id: string; title: string}) {
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState(false);

  async function prepareReply() {
    const url = new URL(studentCoursePath(id), window.location.origin);
    const text = 'Your payment for ' + title + ' is confirmed. Open your course here: ' + url.href +
      '\nSign in with the student account you used to order. You can return to your lessons from My learning.';
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
