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
  const courseData=await compile('lib/data.ts',{});
  const page=await import(await compile('app/(website)/courses/[id]/page.tsx',{
    'next/navigation':moduleUrl('export const notFound=()=>{throw Error("404")}'),
    'next/link':moduleUrl('export default ({children})=>children'),
    'lucide-react':moduleUrl('export const ArrowLeft=()=>null,LockKeyhole=()=>null,Play=()=>null,Plus=()=>null;'),
    '@/components/checkout-button':empty,'@/components/qualification-form':empty,
    '@/components/ui':moduleUrl('export const courseImage=()=>"/course.webp"'),
    '@/lib/qualifications':moduleUrl('export const qualification=()=>null'),
    '@/lib/data':courseData,
    '@/lib/course-information':await compile('lib/course-information.ts',{'./data':courseData}),
    '@/lib/sumup':moduleUrl('export const merchantStatus=()=>{throw Error("checkout should stay closed")}'),
    '@/lib/payments':moduleUrl('export const hasCourseDelivery=()=>true,hasCoursePrice=()=>true;'),
    '@/app/chatgpt-auth':moduleUrl('export const getChatGPTUser=async()=>{throw Error("unavailable")}'),
    '@/lib/staff-navigation':await compile('lib/staff-navigation.ts',{}),
    '@/lib/server':moduleUrl(`export const isOwnerEmail=async()=>false;export const enrolled=async()=>false;export const db=()=>({
      prepare:()=>({bind:()=>({})}),batch:async()=>[
        {results:[{id:'test',title:'Example course',level:'Beginner',price:5000,published:globalThis.courseOutline.published,description:'Studio training',requirements:'No previous experience needed.\\n\\nA student kit is included.',class_dates:'Private entry code 12345',progression:'Develop your nail art portfolio.'}]},
        {results:[{id:'lesson',title:'Example lesson',has_video:1}]}
      ]})`),
    './course.css':moduleUrl(''),
  }));
  const request={params:Promise.resolve({id:'test'})};
  const outline=renderToStaticMarkup(await page.default(request));
  assert.match(outline,/Example lesson/);assert.match(outline,/Check access again/);
  assert.doesNotMatch(outline,/href="\/learn\/|Continue to payment/);
  assert.match(outline,/<summary>Kit Options/);
  assert.match(outline,/A student kit is included/);
  assert.match(outline,/Develop your nail art portfolio/);
  assert.doesNotMatch(outline,/Private entry code/);
  state.published=0;
  await assert.rejects(page.default(request),/404/);
});

test('an editor save uses the public host while rejecting foreign origins',async()=>{
  const {sameSiteOrigin}=await import(await compile('lib/request-origin.ts',{}));
  const url='https://deployment.example/api/admin';
  const request=headers=>new Request(url,{method:'POST',headers});
  assert.ok(sameSiteOrigin(request({host:'academy.example',origin:'https://academy.example'})));
  assert.equal(sameSiteOrigin(request({host:'academy.example',origin:'https://attacker.example','x-forwarded-host':'attacker.example'})),false);
  assert.equal(sameSiteOrigin(request({host:'academy.example',origin:'http://academy.example'})),false);
  assert.equal(sameSiteOrigin(request({host:'academy.example'})),false);
});
