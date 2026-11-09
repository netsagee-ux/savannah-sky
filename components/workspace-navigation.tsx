import {useEffect, useRef} from 'react';
import {ArrowUpRight, BookOpen, Flower, GraduationCap, LibraryBig, LogOut, Menu, MessagesSquare, PanelLeftClose, PanelLeftOpen, ReceiptText, ShieldCheck, ShoppingBag, Star, UsersRound, X} from 'lucide-react';

const groups = [
  {label: 'Teaching', items: [{name:'Courses', icon:LibraryBig}, {name:'Lessons', icon:BookOpen}, {name:'Students', icon:UsersRound}]},
  {label: 'Academy', items: [{name:'Enquiries', icon:MessagesSquare}, {name:'Reviews', icon:Star}, {name:'Payments', icon:ReceiptText}, {name:'Shop', icon:ShoppingBag}]},
];
type Props = {tab:string; busy:boolean; canManageStaff:boolean; displayName:string; email:string; compact:boolean;
  onCollapse:()=>void; onSelect:(tab:string)=>void};

export default function WorkspaceNavigation({tab,busy,canManageStaff,displayName,email,compact,onCollapse,onSelect}:Props) {
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const wide=window.matchMedia('(min-width: 901px)');
    const closeOnDesktop=()=>{if(wide.matches) drawer.current?.close();};
    wide.addEventListener('change',closeOnDesktop);
    return ()=>wide.removeEventListener('change',closeOnDesktop);
  },[]);
  const name = displayName || (canManageStaff?'Academy owner':'Educator');
  const initials = name.split(/\s+/).slice(0,2).map(part=>part.charAt(0)).join('').toUpperCase();
  const brand = <a className="studio-wordmark" href="/" aria-label="Savannah Sky Training Academy home">
    <span className="studio-mark"><Flower aria-hidden="true" size={24}/></span>
    <span className="studio-brand-name">Savannah Sky<small>Training Academy</small></span>
  </a>;
  const links = <>
    <nav aria-label="Workspace sections" className="studio-nav-links">
      {groups.map(group=><div className="studio-nav-group" key={group.label}>
        <p className="studio-group-label">{group.label}</p>
        {group.items.map(({name:label,icon:Icon})=><button key={label} type="button" title={label} aria-label={label}
          aria-current={tab===label?'page':undefined} disabled={busy} onClick={()=>{drawer.current?.close();onSelect(label);}}>
          <Icon aria-hidden="true"/><span>{label}</span></button>)}
      </div>)}
    </nav>
    <nav aria-label="Academy links" className="studio-nav-links studio-secondary-links">
      <p className="studio-group-label">Quick links</p>
      <a href="/dashboard" aria-label="Student view" title="Student view"><GraduationCap/><span>Student view</span></a>
      <a href="/" aria-label="View website" title="View website"><ArrowUpRight/><span>View website</span></a>
      {canManageStaff&&<a href="/admin/staff" aria-current={tab==='Staff access'?'page':undefined} aria-label="Staff access" title="Staff access"><ShieldCheck/><span>Staff access</span></a>}
    </nav>
    <div className="studio-account"><span className="studio-avatar" aria-hidden="true">{initials}</span><span className="studio-user-name">{name}{email&&<small title={email}>{email}</small>}</span>
      <a href="/sign-out?staff=1" title="Sign out" aria-label="Sign out"><LogOut size={17}/></a></div>
  </>;
  return <>
    <aside className="studio-rail"><div className="studio-brand-row">{brand}
      <button type="button" className="studio-icon-button studio-collapse" onClick={onCollapse} title={compact?'Expand sidebar':'Collapse sidebar'} aria-label={compact?'Expand sidebar':'Collapse sidebar'}>
        {compact?<PanelLeftOpen/>:<PanelLeftClose/>}</button></div>{links}</aside>
    <header className="studio-mobile-mast">{brand}<button type="button" className="studio-menu-button" aria-haspopup="dialog" onClick={()=>drawer.current?.showModal()}><Menu size={19}/> Menu</button></header>
    <dialog className="studio-drawer" ref={drawer} aria-label="Workspace navigation" onClick={e=>{if(e.target===drawer.current)drawer.current.close();}}>
      <div><div className="studio-brand-row">{brand}<button type="button" className="studio-icon-button" aria-label="Close menu" onClick={()=>drawer.current?.close()}><X/></button></div>{links}</div>
    </dialog>
  </>;
}
