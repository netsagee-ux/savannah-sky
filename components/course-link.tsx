'use client';

import Link from 'next/link';
import {useState, type ReactNode} from 'react';

export default function CourseLink({href,className,children,featured=false}:{href:string;className:string;children:ReactNode;featured?:boolean}) {
  const [interested,setInterested]=useState(false);
  const prepare=()=>setInterested(true);
  return <Link href={href} className={className} prefetch={featured||interested?true:null}
    onFocus={prepare} onMouseEnter={prepare} onTouchStart={prepare}>{children}</Link>;
}
