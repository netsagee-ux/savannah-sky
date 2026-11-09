import {notFound,redirect} from 'next/navigation';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,owner,staffEmail,educatorInvite} from '@/lib/server';
import StaffAccessWorkspace from '@/components/staff-access-workspace';
import '../workspace.css';
import StaffRequest from '@/components/staff-request';

export const dynamic='force-dynamic';
export default async function StaffAccess(){
  const user=await getChatGPTUser();
  if(!user)redirect('/admin/login?next=%2Fadmin%2Fstaff');
  if(!await owner())notFound();
  const [current,invited,requests]=await Promise.all([staffEmail(),educatorInvite(),
    db().prepare("SELECT id,value FROM settings WHERE id LIKE 'staff-request:%' ORDER BY rowid DESC LIMIT 100").all<{id:string;value:string}>()]);
  return <StaffAccessWorkspace displayName={user.fullName||''} email={user.email}><section className="admin-section studio-course-form"><p>{current?'Approved educator · '+current:'There is no additional educator yet.'}</p>
    <h2>Educator invitation</h2><p>{invited==='invited'?'Ready for the invited educator to verify their own email.':invited==='revoked'?'Invitation revoked.':invited}</p>
    {invited!=='revoked'&&<StaffRequest id="educator-invitation"/>}
    <h2>Access requests</h2><p>Ask your educator to sign in at <a className="underlink" href="/admin/login">Staff sign-in</a> and request access with their own email.</p>
    {requests.results.length?requests.results.map(r=><article className="row" key={r.id}>
      <strong>{r.value}</strong><StaffRequest id={r.id} current={current} email={r.value}/></article>):<p>No pending requests.</p>}
  </section></StaffAccessWorkspace>;
}
