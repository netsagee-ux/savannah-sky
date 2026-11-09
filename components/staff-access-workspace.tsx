'use client';

import {useState, type ReactNode} from 'react';
import {BookOpen, ChevronRight, ArrowUpRight} from 'lucide-react';
import WorkspaceNavigation from './workspace-navigation';

export default function StaffAccessWorkspace({displayName,email,children}:{displayName:string;email:string;children:ReactNode}) {
  const [compact,setCompact]=useState(false);
  return <div className={'studio-workspace'+(compact?' rail-compact':'')}>
    <WorkspaceNavigation tab="Staff access" busy={false} canManageStaff displayName={displayName} email={email} compact={compact}
      onCollapse={()=>setCompact(!compact)} onSelect={tab=>window.location.assign('/admin?tab='+encodeURIComponent(tab))}/>
    <div className="studio-surface"><div className="studio-topbar">
      <div className="studio-crumb"><BookOpen size={17}/>Workspace <ChevronRight size={15}/><strong>Staff access</strong></div>
      <a className="studio-site-link" href="/courses">View catalogue <ArrowUpRight size={16}/></a>
    </div><div className="studio-main"><header className="studio-heading"><h1>Staff access</h1></header>{children}</div></div>
  </div>;
}
