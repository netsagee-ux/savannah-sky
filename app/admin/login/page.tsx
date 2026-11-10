import StaffEntry from '@/components/staff-entry';
import './staff-entry.css';

export const dynamic='force-dynamic';
export const metadata={title:'Staff sign-in'};

export default async function AdminLogin({searchParams}:{searchParams:Promise<{next?:string}>}){
  return <StaffEntry next={(await searchParams).next}/>;
}
