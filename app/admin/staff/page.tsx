import {notFound,redirect} from 'next/navigation';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,owner,staffEmail,educatorInvite} from '@/lib/server';
import StaffRequest from '@/components/staff-request';

export const dynamic='force-dynamic';
export default async function StaffAccess(){
  if(!await getChatGPTUser())redirect('/admin/login?next=%2Fadmin%2Fstaff');
  if(!await owner())notFound();
  const [current,invited,requests]=await Promise.all([staffEmail(),educatorInvite(),
    db().prepare("SELECT id,value FROM settings WHERE id LIKE 'staff-request:%' ORDER BY rowid DESC LIMIT 100").all<{id:string;value:string}>()]);
  return <section className="section admin-section staff-requests"><a className="underlink" href="/admin">Back to dashboard</a>
    <h1>Staff access</h1><p>{current?'Approved educator · '+current:'There is no additional educator yet.'}</p>
    <h2>Educator invitation</h2><p>{invited==='invited'?'Ready for the invited educator to verify their own email.':invited==='revoked'?'Invitation revoked.':invited}</p>
    {invited!=='revoked'&&<StaffRequest id="educator-invitation"/>}
    <h2>Access requests</h2><p>Ask your educator to sign in at <a className="underlink" href="/admin/login">Staff sign-in</a> and request access with their own email.</p>
    {requests.results.length?requests.results.map(r=><article className="row" key={r.id}>
      <strong>{r.value}</strong><StaffRequest id={r.id} current={current} email={r.value}/></article>):<p>No pending requests.</p>}
  </section>;
}
