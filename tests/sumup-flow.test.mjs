import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('SumUp checkout, staff access, reconciliation, buyer-only links and whole-ledger metrics',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'academy-card-'));
  const vars={TURSO_DATABASE_URL:'file:'+join(folder,'db.sqlite'),TURSO_AUTH_TOKEN:'fixture',
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
  const imports={'@/lib/data':await compile('lib/data.ts',{}),'@/lib/qualifications':await compile('lib/qualifications.ts',{'./server':server}),'@/app/chatgpt-auth':auth,'@/lib/server':server,'@/lib/course-invitation':invitations,'@/lib/order-receipt':receipt,
    '@/lib/course-orders':orders,'@/lib/payments':payments,'@/lib/sumup':gateway,'@/lib/student-course-link':urls};
  const route=async p=>import(await compile(p,imports));
  const checkout=await route('app/api/checkout/route.ts'),staff=await route('app/api/payments/route.ts');
  const callback=await route('app/api/sumup/webhook/route.ts'),entry=await route('app/(website)/orders/[id]/learn/route.ts');
  const {salesSummary}=await import(gateway);
  const site='https://academy.example';
  const post=(path,body,origin=site)=>new Request(site+path,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const buy=(courseId='gel')=>checkout.POST(post('/api/checkout',{courseId,price:1,email:'stranger@example.test'}));
  const configure=body=>staff.POST(post('/api/payments',body));
  const as=(id)=>{globalThis.sumupTestUser=id?{userId:id,email:id==='owner'?'netsagee@gmail.com':id+'@example.test',sessionId:'browser'}:null;};
  const code='MTEST123',key='sup_sk_abcdefghijklmnop';
  const remote=new Map();let tamper={},sandbox=true,denyWrite=false,denyRead=false,closedChecks=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer '+key);
    const {pathname,searchParams}=new URL(url);
    if(pathname.startsWith('/v1/merchants/'))return Response.json({merchant_code:code,sandbox,default_currency:'GBP'});
    if(pathname==='/v0.1/checkouts' && options.method==='POST'){
      const body=JSON.parse(options.body);
      if(denyWrite)return new Response(null,{status:403});
      if([...remote.values()].some(item=>item.checkout_reference===body.checkout_reference))return new Response(null,{status:409});
      const id=crypto.randomUUID(),checkout={...body,id,status:'PENDING'};remote.set(id,checkout);return Response.json(checkout);
    }
    if(pathname==='/v0.1/checkouts')return Response.json([...remote.values()].filter(c=>c.checkout_reference===searchParams.get('checkout_reference')));
    const current=remote.get(pathname.split('/').at(-1));assert.ok(current);
    if(options.method==='DELETE'){
      assert.match(current.checkout_reference,/^setup-/);assert.equal(current.amount,1);
      assert.equal(current.status,'PENDING');assert.ok(Date.parse(current.valid_until)-Date.now()<=300_000);
      closedChecks++;remote.delete(current.id);return new Response(null,{status:204});
    }
    assert.equal(options.method,'GET');
    if(denyRead)return new Response(null,{status:403});
    return Response.json({...current,...tamper});
  });
  for(const id of ['gel','art','empty'])await db.prepare("INSERT INTO courses(id,title,description,level,price,published) VALUES(?,?,'Lesson','Beginner',4950,1)").bind(id,id).run();
  for(const id of ['gel','art'])await db.prepare("INSERT INTO lessons(id,course_id,title,position,video_key,body) VALUES(?,?,?,1,'private','Practice')").bind('video-'+id,id,id).run();
  as(null);assert.equal((await buy()).status,401);
  as('buyer');assert.equal((await buy()).status,503);assert.equal((await configure({action:'connect-sumup',code,key})).status,403);
  as('owner');assert.equal((await configure({action:'connect-sumup',code,key})).status,400);
  assert.equal((await configure({action:'staff-access',email:'educator@example.test'})).status,400);
  as('educator');assert.equal((await configure({action:'staff-access',email:'buyer@example.test'})).status,403);
  as('owner');
  sandbox=false;denyWrite=true;
  assert.match((await (await configure({action:'connect-sumup',code,key})).json()).error,/denied access to online checkouts/);
  denyWrite=false;denyRead=true;
  assert.match((await (await configure({action:'connect-sumup',code,key})).json()).error,/denied access to online checkouts/);
  assert.equal(await db.prepare("SELECT id FROM settings WHERE id='sumup:merchant:v1'").first(),null);
  denyRead=false;assert.equal((await configure({action:'connect-sumup',code,key})).status,200);
  assert.equal(closedChecks,2);assert.equal(remote.size,0);
  assert.deepEqual(await salesSummary(),{sales:0,gross:0,customers:0});
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
  as('owner');assert.equal((await configure({action:'confirm-whatsapp',id:orderId})).status,400);
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
  await t.test('shop basket prices, private receipts, idempotent SumUp callbacks and dispatch',async()=>{
    const schema=await compile('lib/shop-schema.ts',{'./server':server});
    const shopUrl=await compile('lib/shop.ts',{'./shop-schema':schema,'./sumup':gateway});
    const lib=await import(shopUrl),extra={...imports,'@/lib/shop':shopUrl,'@/lib/shop-schema':schema,
      '@/lib/video-security':await compile('lib/video-security.ts',{})};
    const manage=await import(await compile('app/api/shop/admin/route.ts',extra));
    const checkout=await import(await compile('app/api/shop/checkout/route.ts',extra));
    const hook=await import(await compile('app/api/shop/webhook/route.ts',extra));
    const product=crypto.randomUUID(),second=crypto.randomUUID(),attempt=crypto.randomUUID();
    const save=(action,fields)=>{const f=new FormData();for(const [k,v] of Object.entries({action,...fields}))f.set(k,v);
      return manage.POST(new Request(site+'/api/shop/admin',{method:'POST',headers:{origin:site},body:f}));};
    const delivery={name:'Fixture Buyer',street:'1 Example Road',line2:'',town:'Bath',postcode:'BA1 1AB'};
    const basket={attempt,delivery,items:[{id:product,quantity:2},{id:second,quantity:1}],total:4300};
    const purchase=(body=basket)=>checkout.POST(post('/api/shop/checkout',body));
    as('buyer');assert.equal((await manage.GET()).status,403);
    as('owner');assert.equal((await save('product',{id:product,title:'Practice kit',description:'Fixture',price:'15.00',published:'1'})).status,200);
    assert.equal((await save('product',{id:second,title:'File set',description:'Fixture',price:'10',published:'1'})).status,200);
    assert.equal((await save('postage',{postage:'3.00'})).status,200);
    as(null);assert.equal((await purchase()).status,401);
    as('buyer');assert.equal((await purchase({...basket,total:1})).status,409);
    const starts=await Promise.all([purchase(),purchase()]);
    for(const res of starts){assert.equal(res.status,200);assert.deepEqual(await res.json(),{path:'/shop/orders/'+attempt});}
    const sessions=[...remote.values()].filter(v=>v.checkout_reference===attempt);assert.equal(sessions.length,1);
    const payment=sessions[0];assert.equal(payment.amount,43);assert.equal(payment.currency,'GBP');assert.ok(payment.return_url.includes('/api/shop/webhook'));
    const saved=await lib.shopOrder(attempt,'buyer');assert.ok(!saved.delivery.includes('Example Road'));assert.deepEqual(lib.deliveryFor(saved),delivery);
    assert.equal(await lib.shopOrder(attempt,'other'),null);
    as('other');assert.equal((await purchase()).status,409);assert.equal((await manage.GET()).status,403);
    as('owner');assert.equal((await save('dispatch',{id:attempt})).status,400);
    const notifyShop=()=>hook.POST(post('/api/shop/webhook?order='+attempt,{event_type:'CHECKOUT_STATUS_CHANGED',id:payment.id,status:'PAID'}));
    await notifyShop();assert.equal((await lib.shopOrder(attempt)).status,'pending');
    payment.status='PAID';tamper={merchant_code:'BAD'};assert.equal((await notifyShop()).status,400);tamper={};
    const before=await grants();await Promise.all([notifyShop(),notifyShop()]);assert.equal(await grants(),before);
    assert.equal((await lib.shopOrder(attempt)).status,'paid');assert.deepEqual(await salesSummary(),{sales:3,gross:14200,customers:1});
    assert.equal((await save('dispatch',{id:attempt,tracking:'test-ref'})).status,200);
    assert.equal((await save('dispatch',{id:attempt})).status,400);
    const visible=await (await manage.GET()).json();assert.equal(visible.orders[0].tracking,'test-ref');assert.equal(visible.orders[0].delivery.postcode,'BA1 1AB');
  });

});
