'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react';
import AcademyWordmark from './academy-wordmark';
import { academyPages } from './academy-navigation';

export default function MobileMenu() {
  const drawer = useRef<HTMLDialogElement>(null);
  const close = () => drawer.current?.close();
  return <>
    <button className="mast-menu" aria-label="Open menu" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}>
      Menu <Menu size={20} strokeWidth={1.6} aria-hidden="true" />
    </button>
    <dialog className="atlas-drawer" ref={drawer} aria-label="Academy menu" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="atlas-drawer-inner">
        <div className="atlas-drawer-head"><Link href="/" onClick={close} aria-label="Academy home"><AcademyWordmark /></Link>
          <button type="button" aria-label="Close menu" onClick={close}><X size={22} /></button></div>
        <nav aria-label="Mobile navigation">{academyPages.map(page =>
          <Link href={page.href} key={page.href} onClick={close}>{page.label}<ArrowUpRight size={18} aria-hidden="true" /></Link>
        )}</nav>
        <a className="drawer-signin" href="/dashboard">My account <ArrowRight size={17}/></a>
      </div>
    </dialog>
  </>;
}
