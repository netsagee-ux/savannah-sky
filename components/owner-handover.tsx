'use client';
import {useState} from 'react';

export default function OwnerHandover({state}:{state:'complete'|'temporary'|'ready'}) {
  const [done,setDone]=useState(state==='complete'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function finish() {
    if(!window.confirm('Make the salon account the sole owner and remove the developer’s dashboard access now?'))return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/owner-handover',{method:'POST'});
      if(!response.ok)throw Error('Open the dashboard with your verified salon account and try again.');
      setDone(true);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="admin-section"><h2>Account handover</h2>
    {done?<p>The salon account is the sole academy owner.</p>:state==='temporary'?
      <p>You’re using the temporary developer login. Your course edits are saved to the academy. To finish the handover, sign in with the salon email and open this section.</p>:
      <><p>You’re signed in with the verified salon email. Complete the handover when you’re ready to remove the developer’s access.</p>
        <button type="button" className="button" disabled={busy} onClick={finish}>{busy?'Saving…':'Complete owner handover'}</button></>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
