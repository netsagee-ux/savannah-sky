import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('workspace and staff approvals use the same verified owner identity',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'academy-roles-'));
  const env={CLERK_SECRET_KEY:'fixture',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'fixture',TURSO_DATABASE_URL:'file:'+join(dir,'roles.db'),TURSO_AUTH_TOKEN:'fixture',ADMIN_EMAIL:''};
  const before=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  Object.assign(process.env,env);
  t.after(async()=>{
    delete globalThis.academyRoleProfile;
    for(const [key,value] of Object.entries(before)){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
    await rm(dir,{recursive:true,force:true});
  });
  const clerk=moduleUrl(`export const auth=async()=>({sessionId:'session',userId:globalThis.academyRoleProfile?.id});
    export const currentUser=async()=>globalThis.academyRoleProfile;`);
  const identity=await compile('app/chatgpt-auth.ts',{
    '@clerk/nextjs/server':clerk,'react':moduleUrl('export const cache=fn=>fn'),
    'next/navigation':moduleUrl('export const redirect=path=>{throw Error(path)}'),
  });
  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const server=await compile('lib/server.ts',{'./vercel-database':adapter,'./vercel-storage':moduleUrl('export const objectStorage=()=>null'),'@/app/chatgpt-auth':identity});
  const {admin,owner,db}=await import(server);
  const {POST}=await import(await compile('app/api/staff-access/route.ts',{'@/lib/server':server,'@/app/chatgpt-auth':identity}));
  const {default:staffPage}=await import(await compile('app/admin/staff/page.tsx',{
    '@/lib/server':server,'@/app/chatgpt-auth':identity,'next/navigation':moduleUrl('export const redirect=()=>{throw Error("sign-in")}; export const notFound=()=>{throw Error("404")}'),
    '@/components/staff-access-workspace':moduleUrl('export default ()=>null'),'@/components/staff-request':moduleUrl('export default ()=>null'),'../workspace.css':moduleUrl(''),
  }));
  const database=db();
  await database.prepare('CREATE TABLE settings(id TEXT PRIMARY KEY,value TEXT NOT NULL)').run();
  function signIn(email,status='verified'){
    globalThis.academyRoleProfile={id:'account',primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:email,verification:{status}}]};
  }
  function approve(){
    return POST(new Request('https://academy.example/api/staff-access',{method:'POST',headers:{origin:'https://academy.example','Content-Type':'application/json'},body:JSON.stringify({action:'approve',current:'',request:'staff-request:person'})}));
  }
  async function checkOwner(email){
    await database.prepare("DELETE FROM settings WHERE id='academy_staff_email'").run();
    await database.prepare("INSERT OR REPLACE INTO settings VALUES('staff-request:person','educator@example.test')").run();
    signIn(email.toUpperCase(),'unverified');
    assert.equal(await owner(),false);assert.equal((await approve()).status,401);
    signIn(email.toUpperCase());
    assert.equal(await admin(),true);assert.equal(await owner(),true);
    assert.equal((await staffPage()).props.email,email.toLowerCase());
    assert.equal((await approve()).status,200);
  }
  await checkOwner('netsagee@gmail.com');
  process.env.ADMIN_EMAIL='configured@example.test';
  await checkOwner(process.env.ADMIN_EMAIL);
  await t.test('the designated co-owner can independently approve staff', {skip:!process.env.TEST_ACADEMY_COOWNER_EMAIL},async()=>{
    await checkOwner(process.env.TEST_ACADEMY_COOWNER_EMAIL);
  });
  signIn('educator@example.test');
  assert.equal(await admin(),true);assert.equal(await owner(),false);assert.equal((await approve()).status,403);
  await assert.rejects(staffPage(),/404/);
  signIn('student@example.test');
  globalThis.academyRoleProfile.emailAddresses.push({id:'secondary',emailAddress:process.env.ADMIN_EMAIL,verification:{status:'verified'}});
  assert.equal(await admin(),false);assert.equal(await owner(),false);assert.equal((await approve()).status,403);
  delete globalThis.academyRoleProfile;
  assert.equal(await owner(),false);assert.equal((await approve()).status,401);
});
