'use client';

import { useRef } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import Brand from './brand';

const links = [
  ['/courses', 'Courses'], ['/about', 'Meet Carla'], ['/faq', 'FAQs'], ['/contact', 'Contact'],
];

export default function MobileMenu({signedIn}: {signedIn: boolean}) {
  const drawer = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className="menu-button" aria-label="Open menu" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Menu /></button>
      <dialog className="studio-drawer" ref={drawer} aria-label="Academy menu" onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
        <div className="drawer-panel">
          <div className="drawer-bar"><Brand /><button className="menu-close" aria-label="Close menu" onClick={() => drawer.current?.close()}><X /></button></div>
          <nav aria-label="Mobile navigation">{links.map(([href, label]) =>
            <a href={href} key={href} onClick={() => drawer.current?.close()}>{label}<ArrowUpRight size={18} /></a>
          )}</nav><a className="button drawer-account" href={signedIn ? "/dashboard" : "/sign-in"}>{signedIn ? "My learning" : "Sign in"} <ArrowUpRight size={17}/></a>
        </div>
      </dialog>
    </>
  );
}
