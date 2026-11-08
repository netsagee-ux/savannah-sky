import {getChatGPTUser} from '@/app/chatgpt-auth';
import './dashboard.css';
export default async function AdminLayout({children}:{children:React.ReactNode}){const user=await getChatGPTUser();return <div className="admin-area"><header className="admin-topbar"><a className="admin-brand" href="/"><span>Savannah Sky<small>ACADEMY WORKSPACE</small></span></a>{user&&<a className="admin-signout" href="/sign-out" target="_top">Sign out ↗</a>}</header><main id="main">{children}</main></div>}
