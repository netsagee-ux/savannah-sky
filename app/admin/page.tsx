import {redirect} from 'next/navigation';import {staffDestination} from '@/lib/staff-navigation';import {admin,owner} from '@/lib/server';import AdminPanel from '@/components/admin-panel';import {getChatGPTUser} from '@/app/chatgpt-auth';import {BookOpen,Users,LayoutDashboard} from 'lucide-react';
export const dynamic='force-dynamic';export const metadata={title:'Admin dashboard'};
export default async function Admin({searchParams}:{searchParams:Promise<{tab?:string;courseId?:string}>}){
 const {tab,courseId}=await searchParams;
 const query=new URLSearchParams();
 if(typeof tab==='string')query.set('tab',tab);
 if(typeof courseId==='string')query.set('courseId',courseId);
 const destination=staffDestination('/admin?'+query);
 const u=await getChatGPTUser();
 if(!await admin())redirect('/admin/login?next='+encodeURIComponent(destination));
 const canManageStaff=await owner();

return <div className="management-shell"><aside className="management-sidebar"><span className="eyebrow">WORKSPACE</span><h2>Academy management</h2><a href="/admin" aria-current="page"><LayoutDashboard size={18}/>Dashboard</a><a href="/dashboard"><Users size={18}/>Student view</a><a href="/"><BookOpen size={18}/>View website ↗</a><p>Administrator<br/>{u?.email}</p></aside><section className="management-main"><div className="management-heading"><div><span className="eyebrow">YOUR ACADEMY</span><h1>Admin dashboard</h1><p>Add courses, upload lessons and manage student access.</p></div><a className="button outline" href="/courses">View course catalogue</a></div>{canManageStaff&&<a className="underlink staff-access-link" href="/admin/staff">Manage staff access requests</a>}<AdminPanel initialTab={new URL(destination,'https://academy.local').searchParams.get('tab')||'Courses'} initialCourse={typeof courseId==='string'?courseId:''}/></section></div>}
