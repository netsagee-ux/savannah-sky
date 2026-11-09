import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('SumUp checkout, staff access, reconciliation, buyer-only links and whole-ledger metrics',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'academy-card-'));
  const vars={TURSO_DATABASE_URL:'file:'+join(folder,'db.sqlite'),TURSO_AUTH_TOKEN:'fixture',ADMIN_EMAIL:'owner@example.test',
    APP_ENCRYPTION_KEY:'test-purpose-only',SUMUP_MERCHANT_CODE:'',SUMUP_API_KEY:'',RESEND_API_KEY:'',ACADEMY_PUBLIC_URL:'https://academy.example'};
  const previous=Object.keys(vars).map(k=>[k,process.env[k]]);
  Object.assign(process.env,vars);
  t.after(async()=>{for(const [key,value] of previous){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    delete globalThis.sumupTestUser;await rm(folder,{recursive:true,force:true});});
  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const db=(await import(adapter)).database();
  for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){
    for(const query of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(query.trim())await db.prepare(query).run();
  }
  const auth=moduleUrl("export const getChatGPTUser=async()=>globalThis.sumupTestUser;export const chatGPTSignInPath=p=>'/sign-in?redirect_url='+encodeURIComponent(p)");
  const server=await compile('lib/server.ts',{'./vercel-database':adapter,'./vercel-storage':moduleUrl("export const objectStorage=()=>({head:async k=>k==='private'?{size:2}:null})"),'@/app/chatgpt-auth':auth});
  const urls=await compile('lib/student-course-link.ts',{});
  const invitations=await compile('lib/course-invitation.ts',{'./server':server,'./student-course-link':urls});
  const receipt=await compile('lib/order-receipt.ts',{'./server':server,'./course-invitation':invitations});
  const orders=await compile('lib/course-orders.ts',{'./server':server,'./order-receipt':receipt});
  const gateway=await compile('lib/sumup.ts',{'./server':server,'./course-invitation':invitations,'./course-orders':orders});
  const payments=await compile('lib/payments.ts',{'./server':server,'./course-orders':orders,'./payment-security':await compile('lib/payment-security.ts',{})});
  const imports={'@/app/chatgpt-auth':auth,'@/lib/server':server,'@/lib/course-invitation':invitations,'@/lib/order-receipt':receipt,
    '@/lib/course-orders':orders,'@/lib/payments':payments,'@/lib/sumup':gateway,'@/lib/student-course-link':urls};
  const route=async p=>import(await compile(p,imports));
  const checkout=await route('app/api/checkout/route.ts'),staff=await route('app/api/payments/route.ts');
  const callback=await route('app/api/sumup/webhook/route.ts'),entry=await route('app/(website)/orders/[id]/learn/route.ts');
  const {salesSummary}=await import(gateway);
  const site='https://academy.example';
  const post=(path,body,origin=site)=>new Request(site+path,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const buy=(courseId='gel')=>checkout.POST(post('/api/checkout',{courseId,price:1,email:'stranger@example.test'}));
  const configure=body=>staff.POST(post('/api/payments',body));
  const as=(id)=>{globalThis.sumupTestUser=id?{userId:id,email:id+'@example.test',sessionId:'browser'}:null;};
  const code='MTEST123',key='sup_sk_abcdefghijklmnop';
  const remote=new Map(),calls=[];let tamper={},sandbox=true;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer '+key);
    const {pathname,searchParams}=new URL(url);
    if(pathname.startsWith('/v1/merchants/'))return Response.json({merchant_code:code,sandbox,default_currency:'GBP'});
    if(pathname==='/v0.1/checkouts' && options.method==='POST'){
      const body=JSON.parse(options.body);calls.push(body);
      if([...remote.values()].some(item=>item.checkout_reference===body.checkout_reference))return new Response(null,{status:409});
      const id=crypto.randomUUID(),checkout={...body,id,status:'PENDING'};remote.set(id,checkout);return Response.json(checkout);
    }
    if(pathname==='/v0.1/checkouts')return Response.json([...remote.values()].filter(c=>c.checkout_reference===searchParams.get('checkout_reference')));
    const current=remote.get(pathname.split('/').at(-1));assert.ok(current);return Response.json({...current,...tamper});
  });
  for(const id of ['gel','art','empty'])await db.prepare("INSERT INTO courses(id,title,description,level,price,published) VALUES(?,?,'Lesson','Beginner',4950,1)").bind(id,id).run();
  for(const id of ['gel','art'])await db.prepare("INSERT INTO lessons(id,course_id,title,position,video_key,body) VALUES(?,?,?,1,'private','Practice')").bind('video-'+id,id,id).run();
  as(null);assert.equal((await buy()).status,401);
  as('buyer');assert.equal((await buy()).status,503);assert.equal((await configure({action:'connect-sumup',code,key})).status,403);
  as('owner');assert.equal((await configure({action:'connect-sumup',code,key})).status,400);
  assert.equal((await configure({action:'staff-access',email:'educator@example.test'})).status,200);
  as('educator');assert.equal((await configure({action:'staff-access',email:'buyer@example.test'})).status,403);
  sandbox=false;assert.equal((await configure({action:'connect-sumup',code,key})).status,200);
  const settings=await (await staff.GET(new Request(site+'/api/payments'))).json();assert.equal(settings.merchant.code,code);
  assert.ok(!JSON.stringify(settings).includes(key));assert.ok(!(await db.prepare("SELECT value FROM settings WHERE id='sumup:merchant:v1'").first()).value.includes(key));
  as('buyer');
  assert.equal((await checkout.POST(post('/api/checkout',{courseId:'gel'},'https://another.example'))).status,403);
  assert.equal((await buy('empty')).status,409);
  const [first,second]=await Promise.all([buy(),buy()]);
  assert.equal(first.status,200);assert.equal(second.status,200);
  const {path}=await first.json();assert.deepEqual(await second.json(),{path});assert.equal(remote.size,1);
  const original=[...remote.values()][0],orderId=path.split('/').pop();
  assert.equal(original.amount,49.50);assert.equal(original.currency,'GBP');assert.equal(original.merchant_code,code);
  assert.equal(original.redirect_url,site+path);assert.ok(original.return_url.endsWith('?order='+orderId));
  const notify=(id=original.id,order=orderId)=>callback.POST(post('/api/sumup/webhook?order='+order,{event_type:'CHECKOUT_STATUS_CHANGED',id,status:'PAID'}));
  const grants=async()=>(await db.prepare('SELECT COUNT(*) AS n FROM enrollments').first()).n;
  await notify();assert.equal(await grants(),0);
  as('educator');assert.equal((await configure({action:'confirm-whatsapp',id:orderId})).status,400);
  assert.equal((await configure({action:'course-password',id:orderId})).status,409);
  original.status='PAID';
  for(const invalid of [{merchant_code:'WRONG'},{amount:1},{currency:'EUR'},{checkout_reference:'other'},{id:'tampered'}]){
    tamper=invalid;assert.equal((await notify()).status,400);assert.equal(await grants(),0);
  }
  tamper={};await Promise.all([notify(),notify()]);assert.equal(await grants(),1);
  assert.deepEqual(await salesSummary(),{sales:1,gross:4950,customers:1});
  const result=await (await configure({action:'course-password',id:orderId})).json();
  assert.equal(result.password,null);assert.match(result.path,/^\/orders\/s1_[\w-]+\/learn$/);
  const open=()=>entry.GET(new Request(site+result.path),{params:Promise.resolve({id:result.path.split('/')[2]})});
  as(null);assert.equal(new URL((await open()).headers.get('location')).pathname,'/sign-in');
  as('stranger');assert.equal((await open()).status,404);
  as('buyer');assert.equal(new URL((await open()).headers.get('location')).pathname,'/learn/video-gel');
  assert.deepEqual(await (await buy()).json(),{path:'/dashboard'});
  const firstArt=await (await buy('art')).json(),expired=[...remote.values()].at(-1);
  expired.status='EXPIRED';assert.equal((await notify(expired.id,firstArt.path.split('/')[2])).status,204);
  const nextArt=await (await buy('art')).json();assert.notEqual(firstArt.path,nextArt.path);
  const successful=[...remote.values()].at(-1);successful.status='PAID';
  await notify(successful.id,nextArt.path.split('/')[2]);assert.equal(await grants(),2);
  assert.deepEqual(await salesSummary(),{sales:2,gross:9900,customers:1});
  await db.prepare("DELETE FROM enrollments WHERE course_id='gel'").run();
  await notify();assert.equal(await grants(),1);assert.equal(new URL((await open()).headers.get('location')).pathname,'/orders/'+orderId);
});
