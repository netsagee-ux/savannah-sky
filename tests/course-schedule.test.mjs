import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {compile,moduleUrl} from './compile-fixture.mjs';

const scheduleModule=await compile('lib/course-schedule.ts',{});
const {parseSchedule,upcomingDates,courseDateLabel}=await import(scheduleModule);
const row={id:'morning',date:'2099-06-12',start:'10:00',end:'16:00',status:'available',note:'Bring your kit'};

test('course dates validate real calendar dates, duplicates and times, and expire in UK local time',()=>{
  assert.deepEqual(parseSchedule(null),{dates:[],message:''});
  const encode=dates=>JSON.stringify({dates,message:''});
  for(const change of [{date:'2099-02-30'},{start:'25:00'},{end:'09:00'},{status:'open'},{note:'x'.repeat(201)}])
    assert.throws(()=>parseSchedule(encode([{...row,...change}])));
  assert.throws(()=>parseSchedule(encode([row,{...row,id:'another'}])));
  assert.throws(()=>parseSchedule(encode([row,{...row,date:'2099-06-13'}])));
  const summer=parseSchedule(encode([{...row,date:'2027-06-12'}]));
  assert.equal(upcomingDates(summer,new Date('2027-06-12T08:59:00Z')).length,1);
  assert.equal(upcomingDates(summer,new Date('2027-06-12T09:00:00Z')).length,0);
  const winter=parseSchedule(encode([{...row,date:'2027-12-12'}]));
  assert.equal(upcomingDates(winter,new Date('2027-12-12T09:59:00Z')).length,1);
  assert.equal(upcomingDates(winter,new Date('2027-12-12T10:00:00Z')).length,0);
  assert.match(courseDateLabel(row),/10:00–16:00 \(UK time\) · Bring your kit/);
});

test('card checkout validates dates and preserves immutable booking snapshots through retries and calendar edits',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'academy-dates-'));
  const env={TURSO_DATABASE_URL:'file:'+join(dir,'db.sqlite'),TURSO_AUTH_TOKEN:'fixture',APP_ENCRYPTION_KEY:'date-tests-only',SUMUP_MERCHANT_CODE:'MTEST123',SUMUP_API_KEY:'fixture',RESEND_API_KEY:''};
  const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);
  t.after(async()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}delete globalThis.scheduleBuyer;await rm(dir,{recursive:true,force:true});});
  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const db=(await import(adapter)).database();
  for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
  const auth=moduleUrl('export const getChatGPTUser=async()=>globalThis.scheduleBuyer');
  const server=await compile('lib/server.ts',{'./vercel-database':adapter,'./vercel-storage':moduleUrl('export const objectStorage=()=>({})'),'@/app/chatgpt-auth':auth});
  const links=await compile('lib/student-course-link.ts',{});
  const invite=await compile('lib/course-invitation.ts',{'./server':server,'./student-course-link':links});
  const receipt=await compile('lib/order-receipt.ts',{'./server':server,'./course-invitation':invite});
  const orders=await compile('lib/course-orders.ts',{'./server':server,'./order-receipt':receipt});
  const gateway=await compile('lib/sumup.ts',{'./server':server,'./course-invitation':invite,'./course-orders':orders,'./paypal':await compile('lib/paypal.ts',{'./server':server})});
  const checkout=await import(await compile('app/api/checkout/route.ts',{'@/app/chatgpt-auth':auth,'@/lib/server':server,'@/lib/sumup':gateway,'@/lib/data':await compile('lib/data.ts',{}),'@/lib/request-origin':await compile('lib/request-origin.ts',{}),'@/lib/qualifications':await compile('lib/qualifications.ts',{'./server':server}),'@/lib/payments':await compile('lib/payments.ts',{'./server':server,'./course-orders':orders,'./payment-security':await compile('lib/payment-security.ts',{})})}));
  const raw=JSON.stringify({dates:[row,{...row,id:'full',date:'2099-06-13',status:'full'},{...row,id:'past',date:'2020-01-01'}],message:'Training dates'});
  await db.prepare("INSERT INTO courses(id,title,description,level,price,published) VALUES('course','Nail training','Practice','Beginner',19900,1)").run();
  await db.prepare("INSERT INTO settings(id,value) VALUES('course-schedule:course',?)").bind(raw).run();
  const as=id=>{globalThis.scheduleBuyer=id?{userId:id,email:id+'@example.test'}:null;};
  const buy=(dateId,extra={})=>checkout.POST(new Request('https://academy.example/api/checkout',{method:'POST',headers:{origin:'https://academy.example','Content-Type':'application/json'},body:JSON.stringify({courseId:'course',dateId,...extra})}));
  const remote=new Map();let changeDuringCheckout=false;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const path=new URL(url).pathname;
    if(path.startsWith('/v1/merchants/')){
      if(changeDuringCheckout)await db.prepare("UPDATE settings SET value=? WHERE id='course-schedule:course'").bind(JSON.stringify({dates:[],message:'Dates changing'})).run();
      return Response.json({merchant_code:'MTEST123',default_currency:'GBP',sandbox:false});
    }
    if(options.method==='POST'){
      const value={...JSON.parse(options.body),id:crypto.randomUUID(),status:'PENDING'};
      remote.set(value.id,value);return Response.json(value);
    }
    const value=remote.get(path.split('/').pop());assert.ok(value);
    if(options.method==='DELETE')value.status='CANCELLED';
    return Response.json(value);
  });
  as(null);assert.equal((await buy('morning')).status,401);as('buyer');
  for(const invalid of [undefined,'full','past','other-course-id'])assert.equal((await buy(invalid)).status,409);
  assert.equal(remote.size,0);
  changeDuringCheckout=true;assert.equal((await buy('morning')).status,409);assert.equal(remote.size,0);
  changeDuringCheckout=false;await db.prepare("UPDATE settings SET value=? WHERE id='course-schedule:course'").bind(raw).run();
  const first=await buy('morning',{amount:1,dateLabel:'Fake date'});assert.equal(first.status,200);
  const {path}=await first.json(),id=path.split('/').pop();
  assert.deepEqual(await (await buy('morning')).json(),{path});assert.equal(remote.size,1);
  const selected=async()=>JSON.parse((await db.prepare('SELECT value FROM settings WHERE id=?').bind('course-date:'+id).first()).value);
  assert.deepEqual(await selected(),{id:'morning',label:courseDateLabel(row)});
  const order=await db.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();assert.equal(order.amount,19900);
  remote.get(order.session_id).status='PAID';await (await import(gateway)).syncSumUp(id);
  await db.prepare("UPDATE settings SET value=? WHERE id='course-schedule:course'").bind(JSON.stringify({dates:[{...row,date:'2099-07-01',status:'full'}],message:'Changed'})).run();
  assert.equal((await selected()).label,courseDateLabel(row));
  const owned=await (await import(orders)).studentOrder(id,globalThis.scheduleBuyer);assert.equal(owned.selected_date,courseDateLabel(row));
  assert.equal(await (await import(orders)).studentOrder(id,{userId:'other',email:'other@example.test'}),null);
  as('new-buyer');assert.equal((await buy('morning')).status,409);
});
