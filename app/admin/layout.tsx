import {ArrowUpRight} from 'lucide-react';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import AcademyWordmark from '@/components/academy-wordmark';
import AccountLayout from '@/components/account-layout';
import './dashboard.css';

export default async function AdminLayout({children}:{children:React.ReactNode}){
  const user=await getChatGPTUser();
  return <AccountLayout staff><div className="admin-area">
    <header className="workspace-mast"><div className="workspace-mast-inner">
      <a className="workspace-brand" href="/" aria-label="Savannah Sky Training Academy home"><AcademyWordmark/></a>
      <a className="workspace-account" href={user?'/sign-out?staff=1':'/sign-in'}>{user?'Sign out':'Student sign-in'}<ArrowUpRight size={16} aria-hidden="true"/></a>
    </div></header>
    <main id="main">{children}</main>
  </div></AccountLayout>;
}
