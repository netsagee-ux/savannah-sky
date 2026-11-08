'use client';

import { useRef } from 'react';
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react';
import AcademyWordmark from './academy-wordmark';
import { academyPages } from './academy-navigation';

export default function MobileMenu({signedIn}: {signedIn: boolean}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const close = () => drawer.current?.close();
  return <>
    <button className="mast-menu" aria-label="Open menu" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}>
      Menu <Menu size={20} strokeWidth={1.6} aria-hidden="true" />
    </button>
    <dialog className="atlas-drawer" ref={drawer} aria-label="Academy menu" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="atlas-drawer-inner">
        <div className="atlas-drawer-head"><a href="/" onClick={close} aria-label="Academy home"><AcademyWordmark /></a>
          <button type="button" aria-label="Close menu" onClick={close}><X size={22} /></button></div>
        <nav aria-label="Mobile navigation">{academyPages.map(page =>
          <a href={page.href} key={page.href} onClick={close}>{page.label}<ArrowUpRight size={18} aria-hidden="true" /></a>
        )}</nav>
        <a className="drawer-signin" href={signedIn ? '/dashboard' : '/sign-in'}>{signedIn ? 'My learning' : 'Sign in'} <ArrowRight size={17}/></a>
      </div>
    </dialog>
  </>;
}
