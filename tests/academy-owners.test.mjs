import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('the shared account form routes verified owners and customers and protects administration',async t=>{
  const before={...process.env};
  Object.assign(process.env,{CLERK_SECRET_KEY:'fixture',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'fixture',ADMIN_EMAIL:'old-owner@example.test'});
  t.after(()=>{
    delete globalThis.academyRoleProfile;
    for(const key of ['CLERK_SECRET_KEY','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','ADMIN_EMAIL']){
      if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];
    }
  });
  const clerk=moduleUrl(`export const auth=async()=>({sessionId:'session',userId:globalThis.academyRoleProfile?.id});
    export const currentUser=async()=>globalThis.academyRoleProfile;`);
  const nav=moduleUrl('export function redirect(path){throw Error(path)}');
  const identity=await compile('app/chatgpt-auth.ts',{
    '@clerk/nextjs/server':clerk,'react':moduleUrl('export const cache=fn=>fn'),'next/navigation':nav,
  });
  const database=moduleUrl(`export const database=()=>({prepare:sql=>({bind:(key)=>{
    if(key!=='academy:owner-handover')throw Error('Unexpected owner setting');
    return {first:async()=>globalThis.handedOver?{id:key}:null,run:async()=>{globalThis.handedOver=true}};
  }})});`);
  t.after(()=>delete globalThis.handedOver);
  const server=await compile('lib/server.ts',{'./vercel-database':database,'./vercel-storage':moduleUrl('export const objectStorage=()=>null'),'@/app/chatgpt-auth':identity});
  const staffNav=await compile('lib/staff-navigation.ts',{});
  const accountNav=await compile('lib/account-navigation.ts',{'./staff-navigation':staffNav});
  const common={'@/app/chatgpt-auth':identity,'next/navigation':nav,'@/lib/server':server,'@/lib/account-navigation':accountNav,'@clerk/nextjs/server':clerk};
  const page=async(path,imports={})=>(await import(await compile(path,{...common,...imports}))).default;
  const placeholder=moduleUrl('export default function Stub(){}');
  const login=await page('app/(website)/sign-in/[[...sign-in]]/page.tsx',{
    '@clerk/nextjs':moduleUrl('export function SignIn(){}'),'@/components/auth-frame':placeholder,'./entry.css':moduleUrl(''),
  });
  const finish=await page('app/(website)/account/continue/page.tsx');
  const legacy=await page('app/admin/login/page.tsx');
  const signup=await page('app/(website)/sign-up/[[...sign-up]]/page.tsx');
  const {courseEditPath,staffDestination}=await import(staffNav);
  const editPath=courseEditPath('gel-foundations');
  assert.equal(staffDestination(editPath),editPath);
  assert.equal(staffDestination('/admin?tab=Courses&action=edit&courseId=%2F..%2F'),'/admin?tab=Courses');
  const workspace=await page('app/admin/page.tsx',{'@/lib/staff-navigation':staffNav,'@/components/admin-panel':placeholder,'./workspace.css':moduleUrl('')});
  const dashboard=await page('app/(website)/dashboard/page.tsx',{'@/components/student-desk':placeholder,'@/lib/course-orders':moduleUrl('export const claimPaidOrders=async()=>null')});
  const {admin}=await import(server);
  const deep='/orders/s1_buyerToken/learn';
  const args=(params={})=>({params:Promise.resolve({}),searchParams:Promise.resolve(params)});
  const goes=(promise,path)=>assert.rejects(promise,e=>e.message===path);
  function identify(email,verified=true){
    globalThis.academyRoleProfile={id:'account',primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:email,verification:{status:verified?'verified':'unverified'}}]};
  }
  const form=(await login(args({redirect_url:deep}))).props.children;
  assert.equal(form.props.withSignUp,true);
  assert.equal(form.props.forceRedirectUrl,'/account/continue?next='+encodeURIComponent(deep));
  assert.equal(form.props.signUpForceRedirectUrl,form.props.forceRedirectUrl);
  await goes(legacy(args()),'/sign-in');
  await goes(signup(args({redirect_url:deep})),'/sign-in?redirect_url='+encodeURIComponent(deep));
  await goes(finish(args()),'/sign-in?redirect_url=%2Fdashboard');
  assert.equal(await admin(),false);
  async function checkOwner(email){
    identify(email.toUpperCase(),false);
    assert.equal(await admin(),false);
    assert.match(JSON.stringify((await finish(args())).props.children),/Verify your email/);
    identify(email.toUpperCase());
    assert.equal(await admin(),true);
    await goes(login(args()),'/admin');
    await goes(finish(args({next:deep})),'/admin');
    await goes(dashboard(args()),'/admin');
    assert.equal((await workspace(args())).props.email,email.toLowerCase());
  }
  await checkOwner('netsagee@gmail.com');
  await t.test('verified salon owner uses the same login', {skip:!process.env.TEST_ACADEMY_COOWNER_EMAIL},()=>checkOwner(process.env.TEST_ACADEMY_COOWNER_EMAIL));
  for(const email of ['netsage@gmail.com','student@example.test',process.env.ADMIN_EMAIL]){
    identify(email);
    globalThis.academyRoleProfile.emailAddresses.push({id:'secondary',emailAddress:'netsagee@gmail.com',verification:{status:'verified'}});
    assert.equal(await admin(),false);
    await goes(login(args()),'/dashboard');
    await goes(finish(args({next:'/admin?tab=Payments'})),'/dashboard');
    await goes(workspace(args()),'/dashboard');
    assert.equal((await dashboard(args())).props.staff,false);
    for(const path of [deep,'/shop#basket','/courses/gel#enrol','/learn/lesson-1','/payment-result?session_id=abc'])
      await goes(finish(args({next:path})),path);
    for(const path of ['//outside.example','https://outside.example','/api/admin','/admin/login','/sign-out','/account/continue'])
      await goes(finish(args({next:path})),'/dashboard');
  }
  const handover=await import(await compile('app/api/owner-handover/route.ts',{'@/lib/server':server}));
  const site='https://academy.example';
  const seal=(origin=site)=>handover.POST(new Request(site+'/api/owner-handover',{method:'POST',headers:{origin}}));
  identify('netsagee@gmail.com');assert.equal((await seal()).status,403);
  if(process.env.TEST_ACADEMY_COOWNER_EMAIL){
    identify(process.env.TEST_ACADEMY_COOWNER_EMAIL,false);assert.equal((await seal()).status,403);
    identify(process.env.TEST_ACADEMY_COOWNER_EMAIL);assert.equal((await seal('https://elsewhere.example')).status,403);
    assert.ok((await seal()).ok);assert.ok((await seal()).ok);assert.equal(await admin(),true);
    identify('netsagee@gmail.com');assert.equal(await admin(),false);
    await goes(workspace(args()),'/dashboard');await goes(login(args()),'/dashboard');
  }

});
