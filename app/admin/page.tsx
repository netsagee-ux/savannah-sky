import {redirect} from 'next/navigation';
import {staffDestination} from '@/lib/staff-navigation';
import {isOwnerEmail} from '@/lib/server';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import AdminPanel from '@/components/admin-panel';
import './workspace.css';

export const dynamic='force-dynamic';
export const metadata={title:'Academy workspace'};

export default async function Admin({searchParams}:{searchParams:Promise<{tab?:string;courseId?:string;action?:string}>}){
  const {tab,courseId,action}=await searchParams;
  const query=new URLSearchParams();
  if(typeof tab==='string')query.set('tab',tab);
  if(typeof courseId==='string')query.set('courseId',courseId);
  if(typeof action==='string')query.set('action',action);
  const destination=staffDestination('/admin?'+query);
  const user=await requireChatGPTUser(destination);
  if(!isOwnerEmail(user.email))redirect('/dashboard');
  const params=new URL(destination,'https://academy.local').searchParams;
  return <AdminPanel initialTab={params.get('tab')||'Courses'} initialCourse={params.get('courseId')||''}
    startCreating={params.get('action')==='create'} email={user.email} displayName={user.fullName||''}/>;
}
