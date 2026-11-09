import {useEffect,useRef} from 'react';
import {ArrowUpRight,BookOpen,GraduationCap,LibraryBig,LogOut,Menu,MessagesSquare,PanelLeftClose,ReceiptText,ShieldCheck,ShoppingBag,Star,UsersRound} from 'lucide-react';
import AcademyWordmark from './academy-wordmark';

const sections=[
  {name:'Courses',icon:LibraryBig},{name:'Lessons',icon:BookOpen},{name:'Students',icon:UsersRound},
  {name:'Enquiries',icon:MessagesSquare},{name:'Reviews',icon:Star},{name:'Payments',icon:ReceiptText},{name:'Shop',icon:ShoppingBag},
];
type Props={tab:string;busy:boolean;canManageStaff:boolean;displayName:string;onSelect:(tab:string)=>void};
export default function WorkspaceNavigation({tab,busy,canManageStaff,displayName,onSelect}:Props){
  const drawer=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const wide=window.matchMedia('(min-width: 901px)');
    const closeOnDesktop=()=>{if(wide.matches)drawer.current?.close();};
    wide.addEventListener('change',closeOnDesktop);
    return ()=>wide.removeEventListener('change',closeOnDesktop);
  },[]);
  const brand=<a className="workspace-brand studio-wordmark" href="/" aria-label="Savannah Sky Training Academy home"><AcademyWordmark/></a>;
  const nav=<>
    <nav aria-label="Workspace sections" className="studio-nav-links">{sections.map(({name,icon:Icon})=><button type="button" key={name}
      aria-current={tab===name?'page':undefined} disabled={busy} onClick={()=>{drawer.current?.close();onSelect(name);}}>
      <Icon size={20} strokeWidth={1.65} aria-hidden="true"/>{name}</button>)}</nav>
    <nav aria-label="Academy links" className="studio-nav-links studio-secondary-links">
      <a href="/dashboard"><GraduationCap/>Student view</a><a href="/"><ArrowUpRight/>View website</a>
      {canManageStaff&&<a href="/admin/staff"><ShieldCheck/>Staff access</a>}
    </nav>
    <div className="studio-account"><span>{displayName|| (canManageStaff?'Academy owner':'Educator')}</span>
      <a href="/sign-out?staff=1"><LogOut aria-hidden="true" size={16}/>Sign out</a></div></>;
  return <>
    <aside className="studio-rail">{brand}{nav}</aside>
    <header className="studio-mobile-mast">{brand}<button type="button" className="studio-menu-button" aria-haspopup="dialog"
      onClick={()=>drawer.current?.showModal()}><Menu size={20}/> Menu</button></header>
    <dialog className="studio-drawer" ref={drawer} aria-label="Workspace navigation"
      onClick={e=>{if(e.target===drawer.current)drawer.current.close();}}>
      <div><button type="button" className="studio-menu-button" onClick={()=>drawer.current?.close()}><PanelLeftClose size={19}/> Close</button>{nav}</div>
    </dialog>
  </>;
}
