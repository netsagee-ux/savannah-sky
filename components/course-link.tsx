'use client';

import Link from 'next/link';
import {useState, type ReactNode} from 'react';

export default function CourseLink({href,className,children}:{href:string;className:string;children:ReactNode}) {
  const [interested,setInterested]=useState(false);
  const prepare=()=>setInterested(true);
  return <Link href={href} className={className} prefetch={interested?true:null}
    onFocus={prepare} onMouseEnter={prepare} onTouchStart={prepare}>{children}</Link>;
}
