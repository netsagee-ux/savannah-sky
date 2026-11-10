import StaffEntry from '@/components/staff-entry';
import '../staff-entry.css';

export const dynamic='force-dynamic';
export const metadata={title:'Set up staff sign-in'};

export default async function StaffActivation({searchParams}:{searchParams:Promise<{next?:string}>}){
  return <StaffEntry activate next={(await searchParams).next}/>;
}
