import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('a staff login link copied from a message recovers its path and keeps the requested lesson',async()=>{
  const middleware=await import(await compile('proxy.ts',{
    '@clerk/nextjs/server':moduleUrl('export const clerkMiddleware=()=>()=>null'),
    'next/server':moduleUrl('export const NextResponse={redirect:(url,status)=>Response.redirect(url,status),next:()=>null}'),
  }));
  for(const origin of ['savannah-sky.vercel.app','savannah-sky-k4rz-three.vercel.app']){
    for(const suffix of [')','%29','.']){
      const url=new URL('https://'+origin+'/admin/login'+suffix+'?next=%2Fadmin%3Ftab%3DLessons');
      url.clone=()=>new URL(url);
      const result=middleware.default({method:'GET',nextUrl:url},{});
      assert.equal(result.status,307);
      const target=new URL(result.headers.get('location'));
      assert.equal(target.hostname,'savannah-sky-k4rz-three.vercel.app');
      assert.equal(target.pathname,'/admin/login');
      assert.equal(target.searchParams.get('next'),'/admin?tab=Lessons');
    }
  }
});

test('a temporary account lookup error leaves only the published course outline available',async t=>{
  const state={published:1};
  globalThis.courseOutline=state;
  t.after(()=>{delete globalThis.courseOutline;});
  const empty=moduleUrl('export default ()=>null');
  const page=await import(await compile('app/(website)/courses/[id]/page.tsx',{
    'next/navigation':moduleUrl('export const notFound=()=>{throw Error("404")}'),
    'next/link':moduleUrl('export default ({children})=>children'),
    'lucide-react':moduleUrl('export const ArrowLeft=()=>null,LockKeyhole=()=>null,Play=()=>null;'),
    '@/components/checkout-button':empty,'@/components/qualification-form':empty,
    '@/components/ui':moduleUrl('export const courseImage=()=>"/course.webp"'),
    '@/lib/qualifications':moduleUrl('export const qualification=()=>null'),
    '@/lib/data':await compile('lib/data.ts',{}),
    '@/lib/sumup':moduleUrl('export const merchantStatus=()=>{throw Error("checkout should stay closed")}'),
    '@/lib/payments':moduleUrl('export const hasCourseDelivery=()=>true,hasCoursePrice=()=>true;'),
    '@/app/chatgpt-auth':moduleUrl('export const getChatGPTUser=async()=>{throw Error("unavailable")}'),
    '@/lib/server':moduleUrl(`export const enrolled=async()=>false;export const db=()=>({prepare:()=>({bind:()=>({
      first:async()=>({id:'test',title:'Example course',level:'Beginner',price:5000,published:globalThis.courseOutline.published}),
      all:async()=>({results:[{id:'lesson',title:'Example lesson',has_video:1}]})})})})`),
    './course.css':moduleUrl(''),
  }));
  const request={params:Promise.resolve({id:'test'})};
  const outline=renderToStaticMarkup(await page.default(request));
  assert.match(outline,/Example lesson/);assert.match(outline,/Check access again/);
  assert.doesNotMatch(outline,/href="\/learn\/|Continue to payment/);
  state.published=0;
  await assert.rejects(page.default(request),/404/);
});
