import {clerkMiddleware} from '@clerk/nextjs/server';
import {NextResponse,type NextRequest,type NextFetchEvent} from 'next/server';
const clerk=clerkMiddleware();
export default function proxy(req:NextRequest,event:NextFetchEvent){
 if(req.nextUrl.hostname==='savannah-sky.vercel.app'){
   const destination=new URL('https://savannah-sky-k4rz-three.vercel.app');
   destination.pathname=req.nextUrl.pathname;
   destination.search=req.nextUrl.search;
   return NextResponse.redirect(destination,307);
 }
 if(!process.env.CLERK_SECRET_KEY||!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)return NextResponse.next();
 return clerk(req,event);
}
export const config={matcher:['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)','/(api|trpc)(.*)','/__clerk/:path*']};
