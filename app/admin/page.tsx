import {redirect} from 'next/navigation';
import {staffDestination} from '@/lib/staff-navigation';
import {admin,owner} from '@/lib/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import AdminPanel from '@/components/admin-panel';
import './workspace.css';

export const dynamic='force-dynamic';
export const metadata={title:'Academy workspace'};

export default async function Admin({searchParams}:{searchParams:Promise<{tab?:string;courseId?:string}>}){
  const {tab,courseId}=await searchParams;
  const query=new URLSearchParams();
  if(typeof tab==='string')query.set('tab',tab);
  if(typeof courseId==='string')query.set('courseId',courseId);
  const destination=staffDestination('/admin?'+query);
  if(!await admin())redirect('/admin/login?next='+encodeURIComponent(destination));
  const [user,canManageStaff]=await Promise.all([getChatGPTUser(),owner()]);
  const params=new URL(destination,'https://academy.local').searchParams;
  return <AdminPanel initialTab={params.get('tab')||'Courses'} initialCourse={params.get('courseId')||''}
    canManageStaff={canManageStaff} displayName={user?.fullName||''}/>;
}
