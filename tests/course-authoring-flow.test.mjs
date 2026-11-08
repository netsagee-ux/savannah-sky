import assert from 'node:assert/strict';
import {readdir, readFile, mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {test} from 'node:test';
import {compile, moduleUrl} from './compile-fixture.mjs';

test('administrator uploads a course and a guest can claim it once after a verified WhatsApp payment', async t => {
  const dir=await mkdtemp(join(tmpdir(),'academy-authoring-'));
  const env={TURSO_DATABASE_URL:'file:'+join(dir,'academy.db'), TURSO_AUTH_TOKEN:'test', ADMIN_EMAIL:'teacher@example.test',
    CLERK_SECRET_KEY:'test',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'test',APP_ENCRYPTION_KEY:'private-test-key',
    ACADEMY_WHATSAPP_NUMBER:'',BLOB_READ_WRITE_TOKEN:'',BLOB_STORE_ID:'',RESEND_API_KEY:'',STRIPE_SECRET_KEY:''};
  const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  Object.assign(process.env,env);
  const files=new Map(), state={user:null};
  globalThis.authoringTest={state, storage:{
    async put(key,data,opts){files.set(key,{bytes:new Uint8Array(await new Response(data).arrayBuffer()),type:opts.httpMetadata.contentType});},
    async head(key){const file=files.get(key);return file?{size:file.bytes.length}:null;},
    async get(key,options){const file=files.get(key);if(!file)return null;const range=options?.range;
      return {body:range?file.bytes.slice(range.offset,range.offset+range.length):file.bytes,size:file.bytes.length,
        writeHttpMetadata:h=>h.set('Content-Type',file.type)};},
    async delete(keys){for(const key of [keys].flat())files.delete(key);},
  }};
  t.after(async()=>{delete globalThis.authoringTest;for(const [key,value] of Object.entries(previous)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }await rm(dir,{force:true,recursive:true});});

  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const db=(await import(adapter)).database();
  for(const path of (await readdir('drizzle')).filter(path=>path.endsWith('.sql')).sort()){
    for(const sql of (await readFile('drizzle/'+path,'utf8')).split('--> statement-breakpoint')){
      if(sql.trim())await db.prepare(sql).run();
    }
  }
  const auth=moduleUrl("export const getChatGPTUser=async()=>globalThis.authoringTest.state.user; export const chatGPTSignInPath=path=>'/sign-in?redirect_url='+encodeURIComponent(path)");
  const server=await compile('lib/server.ts',{'./vercel-database':adapter,'./vercel-storage':moduleUrl('export const objectStorage=()=>globalThis.authoringTest.storage'),'@/app/chatgpt-auth':auth});
  const urls=await compile('lib/student-course-link.ts',{});
  const receipt=await compile('lib/order-receipt.ts',{'./server':server,'./student-course-link':urls});
  const orders=await compile('lib/course-orders.ts',{'./server':server,'./order-receipt':receipt});
  const security=await compile('lib/payment-security.ts',{});
  const payments=await compile('lib/payments.ts',{'./server':server,'./course-orders':orders,'./payment-security':security});
  const modules={'@/lib/server':server,'@/lib/course-orders':orders,'@/lib/order-receipt':receipt,'@/lib/payments':payments,
    '@/lib/payment-security':security,'@/lib/video-security':await compile('lib/video-security.ts',{}),'@/app/chatgpt-auth':auth,
    '@/lib/lesson-upload':await compile('lib/lesson-upload.ts',{}),'@/lib/student-course-link':urls,'@vercel/blob':import.meta.resolve('@vercel/blob')};
  const route=async path=>import(await compile(path,modules));
  const author=await route('app/api/admin/route.ts'), checkout=await route('app/api/checkout/route.ts');
  const pay=await route('app/api/payments/route.ts'), entry=await route('app/(website)/orders/[id]/learn/route.ts');
  const token=await route('app/api/video-access/route.ts'),stream=await route('app/api/video/[id]/route.ts');
  const origin='https://academy.example';
  const post=(path,fields)=>new Request(origin+path,{method:'POST',headers:{origin,...(fields instanceof FormData?{}:{'Content-Type':'application/json'})},body:fields instanceof FormData?fields:JSON.stringify(fields)});
  const save=(action,data)=>{const form=new FormData();form.set('action',action);for(const [k,v] of Object.entries(data))form.set(k,v);return author.POST(post('/api/admin',form));};
  const payment=data=>pay.POST(post('/api/payments',data));
  const owner={userId:'teacher',email:'teacher@example.test',sessionId:'staff'};
  const buyer={userId:'student-a',email:'learner@example.test',sessionId:'phone'};
  const stranger={userId:'student-b',email:'other@example.test',sessionId:'tablet'};
  const course={title:'Studio practice',description:'A private training demonstration.',level:'Beginner',price:'49.50',published:'0'};
  assert.equal((await save('course',course)).status,403);
  state.user=owner;
  const courseId=(await (await save('course',course)).json()).courseId;
  assert.ok(courseId);
  const lesson={courseId,title:'Prepare the nail',position:'1'};
  assert.equal((await save('lesson',lesson)).status,400);
  // A two-frame, 32px VP9 recording. The actual upload and streaming handlers round-trip its bytes.
  const video=Buffer.from('GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAH6EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEjTbuMU6uEHFO7a1OsggHk7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAeQAAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WIpvfJr9g5ExucgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4QL68IA4JCwgSC6gSCagQJVsIRVuYEBElTDZ0B/c3OfY8CAZ8iZRaOHRU5DT0RFUkSHjExhdmY2MS43LjEwM3Nz2mPAi2PFiKb3ya/YORMbZ8ilRaOHRU5DT0RFUkSHmExhdmM2MS4xOS4xMDEgbGlidnB4LXZwOWfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDAuNDAwMDAwMDAwAB9DtnW354EAo52BAACAgkmDQgAB8AH2ADgkHBhKAAAwYAAAItXAAKOTgQDIAIYAQJKcAFAAAAMgAABDQBxTu2uRu4+zgQC3iveBAfGCAajwgQM=','base64');
  const file=new File([video],'studio.webm',{type:'video/webm'});
  assert.equal((await save('lesson',{...lesson,video:file})).status,200);
  const lessonId=(await db.prepare('SELECT id FROM lessons WHERE course_id=?').bind(courseId).first()).id;
  assert.equal((await save('lesson',{...lesson,id:lessonId,removeVideo:'1'})).status,400);
  const intent=crypto.randomUUID(), fields={courseId,handoff:true,email:' Learner@example.test ',intent};
  const order=(overrides={})=>checkout.POST(post('/api/checkout',{...fields,...overrides}));
  const watch=()=>token.POST(post('/api/video-access',{lessonId}));
  state.user=null;
  assert.equal((await order()).status,409);
  state.user=owner;
  assert.equal((await save('visibility',{id:courseId,published:'1'})).status,200);
  state.user=null;
  assert.equal((await order({email:'wrong'})).status,400);
  assert.equal((await (await order()).json()).callbackRequired,true);
  const callback={email:'callback@example.test',intent:crypto.randomUUID(),callback:'+44 7700 900099'};
  await db.prepare('UPDATE courses SET price=NULL WHERE id=?').bind(courseId).run();
  const request=await (await order(callback)).json();
  assert.equal(request.callbackSaved,true);
  assert.equal((await (await order(callback)).json()).orderId,request.orderId);
  state.user=owner;
  assert.equal((await payment({action:'confirm-whatsapp',id:request.orderId})).status,400);
  assert.equal((await payment({action:'quote',id:request.orderId,price:'12.50'})).status,200);
  assert.equal((await db.prepare('SELECT amount FROM orders WHERE id=?').bind(request.orderId).first()).amount,1250);
  state.user=null;
  assert.equal((await (await order(callback)).json()).orderId,request.orderId);
  await db.prepare('UPDATE courses SET price=4950 WHERE id=?').bind(courseId).run();
  state.user=owner;
  assert.equal((await payment({action:'whatsapp',number:'+44 7700 900123'})).status,200);
  state.user=null;
  // The academy can accept a WhatsApp order and agree its fee in the buyer’s chat.
  await db.prepare('UPDATE courses SET price=NULL WHERE id=?').bind(courseId).run();
  const enquiry={email:'quote@example.test',intent:crypto.randomUUID()};
  const direct=await (await order(enquiry)).json();
  assert.equal(new URL(direct.url).hostname,'wa.me');
  assert.equal(new URL(direct.url).pathname,'/447700900123');
  assert.match(new URL(direct.url).searchParams.get('text'),/course fee and payment details/);
  assert.doesNotMatch(direct.url,/%C2%A30\.00/);
  state.user=owner;
  assert.equal((await payment({action:'confirm-whatsapp',id:direct.orderId})).status,400);
  assert.equal((await payment({action:'quote',id:direct.orderId,price:'18.50'})).status,200);
  state.user=null;
  const quoted=await (await order(enquiry)).json();
  assert.equal(quoted.orderId,direct.orderId);
  assert.match(new URL(quoted.url).searchParams.get('text'),/£18.50/);
  await db.prepare('UPDATE courses SET price=4950 WHERE id=?').bind(courseId).run();
  const created=await order();assert.equal(created.status,200);
  const {orderId,url,guest}=await created.json();
  assert.equal(guest,true);
  assert.equal(new URL(url).hostname,'wa.me');
  assert.ok(new URL(url).searchParams.get('text').includes('£49.50'));
  assert.equal((await (await order()).json()).orderId,orderId);
  const open=()=>entry.GET(new Request(origin+'/orders/'+orderId+'/learn'),{params:Promise.resolve({id:orderId})});
  const confirm=()=>payment({action:'confirm-whatsapp',id:orderId});
  assert.equal((await confirm()).status,403);
  state.user=buyer;
  assert.equal((await confirm()).status,403);
  assert.equal(new URL((await open()).headers.get('location')).pathname,'/orders/'+orderId);
  assert.equal((await watch()).status,403);
  state.user=owner;
  assert.equal((await (await payment({action:'course-password',id:orderId})).json()).password,null);
  assert.equal((await confirm()).status,200);
  const {password}=await (await payment({action:'course-password',id:orderId})).json();
  assert.match(password,/^[A-F0-9]{4}(-[A-F0-9]{4}){3}$/);
  const activation=await route('app/api/orders/[id]/activate/route.ts');
  const unlock=(value)=>activation.POST(post('/api/orders/'+orderId+'/activate',{password:value}),{params:Promise.resolve({id:orderId})});
  const lookup=()=>pay.GET(new Request(origin+'/api/payments?order='+orderId));
  assert.equal((await (await lookup()).json()).orders[0].awaitingClaim,1);
  assert.equal((await db.prepare('SELECT * FROM enrollments').all()).results.length,0);
  state.user=null;
  assert.equal(new URL((await open()).headers.get('location')).pathname,'/sign-in');
  state.user=stranger;
  assert.equal((await unlock(password)).status,403);
  assert.equal((await open()).status,404);
  assert.equal((await watch()).status,403);
  state.user=buyer;
  // An older purchase under the same email must retain its own revocable entitlement.
  await db.prepare("INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at) VALUES('older','former-owner',?,?,?,4950,'gbp','paid','live','2025-12-01')").bind(buyer.email,courseId,course.title).run();
  await db.prepare('INSERT INTO enrollments(id,email,course_id) VALUES(?,?,?)').bind(buyer.email+':'+courseId,buyer.email,courseId).run();
  const {claimPaidOrders}=await import(orders);
  await claimPaidOrders(buyer);
  assert.equal((await unlock('0000-1111-2222-3333')).status,403);
  assert.equal((await watch()).status,403);
  const activations=await Promise.all([unlock(password),unlock(password)]);
  assert.ok(activations.every(result=>result.ok));
  assert.equal(new URL((await open()).headers.get('location')).pathname,'/learn/'+lessonId);
  const playbackUrl=(await (await watch()).json()).url;
  const play=()=>stream.GET(new Request(origin+playbackUrl),{params:Promise.resolve({id:lessonId})});
  assert.deepEqual(Buffer.from(await (await play()).arrayBuffer()),video);
  state.user={...stranger,email:buyer.email};
  assert.equal((await open()).status,404);
  assert.equal((await play()).status,403);
  state.user=owner;
  assert.equal((await (await lookup()).json()).orders[0].awaitingClaim,0);
  assert.equal((await save('revoke',{id:'buyer/'+buyer.userId+'/'+courseId})).status,200);
  assert.equal((await confirm()).status,200);
  state.user=buyer;
  await claimPaidOrders(buyer);
  assert.equal((await play()).status,403);
  assert.ok(await db.prepare('SELECT id FROM enrollments WHERE id=?').bind('buyer/former-owner/'+courseId).first());
  assert.equal(new URL((await open()).headers.get('location')).pathname,'/orders/'+orderId);
  state.user=null;
  const invite=(await (await order({intent:crypto.randomUUID(),email:stranger.email})).json()).orderId;
  state.user=owner;
  assert.equal((await payment({action:'confirm-whatsapp',id:invite})).status,200);
  assert.equal((await payment({action:'withdraw-claim',id:invite})).status,200);
  state.user=stranger;
  await claimPaidOrders(stranger);
  assert.equal((await watch()).status,403);
});
