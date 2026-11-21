import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('direct PayPal course and shop orders',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'academy-wallet-'));
  const site='https://academy.example',merchant='MERCHANT12345';
  const vars={TURSO_DATABASE_URL:'file:'+join(folder,'db.sqlite'),TURSO_AUTH_TOKEN:'fixture',
    APP_ENCRYPTION_KEY:'wallet-fixture',ACADEMY_PUBLIC_URL:site,RESEND_API_KEY:'',SUMUP_API_KEY:'',SUMUP_MERCHANT_CODE:''};
  const old=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));
  Object.assign(process.env,vars);
  t.after(async()=>{for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    delete globalThis.paypalBuyer;await rm(folder,{recursive:true,force:true});});

  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const db=(await import(adapter)).database();
  for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){
    for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
  }
  const auth=moduleUrl('export const getChatGPTUser=async()=>globalThis.paypalBuyer');
  const server=await compile('lib/server.ts',{'./vercel-database':adapter,'./vercel-storage':moduleUrl('export const objectStorage=()=>({})'),'@/app/chatgpt-auth':auth});
  const urls=await compile('lib/student-course-link.ts',{});
  const invitations=await compile('lib/course-invitation.ts',{'./server':server,'./student-course-link':urls});
  const receipt=await compile('lib/order-receipt.ts',{'./server':server,'./course-invitation':invitations});
  const orders=await compile('lib/course-orders.ts',{'./server':server,'./order-receipt':receipt});
  const paypal=await compile('lib/paypal.ts',{'./server':server});
  const sumup=await compile('lib/sumup.ts',{'./server':server,'./paypal':paypal,'./course-orders':orders,'./course-invitation':invitations});
  const schema=await compile('lib/shop-schema.ts',{'./server':server});
  const shopModule=await compile('lib/shop.ts',{'./shop-schema':schema,'./sumup':sumup,'./shop-types':await compile('lib/shop-types.ts',{}),'./paypal':paypal});
  const refunds=await import(await compile('lib/shop-refunds.ts',{'./shop-schema':schema,'./sumup':sumup,'./paypal':paypal}));
  const modules={'@/lib/request-origin':await compile('lib/request-origin.ts',{}),'@/app/chatgpt-auth':auth,'@/lib/course-orders':orders,
    '@/lib/shop':shopModule,'@/lib/paypal':paypal,'@/lib/sumup':sumup,'@/lib/server':server,'@/lib/course-invitation':invitations,'@/lib/order-receipt':receipt,
    '@/lib/payments':await compile('lib/payments.ts',{'./server':server,'./course-orders':orders,'./payment-security':await compile('lib/payment-security.ts',{})}),
    '@/lib/data':await compile('lib/data.ts',{}),'@/lib/qualifications':await compile('lib/qualifications.ts',{'./server':server})};
  const route=async path=>import(await compile(path,modules));
  const course=await route('app/api/checkout/route.ts'),checkout=await route('app/api/shop/checkout/route.ts');
  const confirm=await route('app/api/paypal/confirm/route.ts'),staff=await route('app/api/payments/route.ts');
  const wallet=await import(paypal),gateway=await import(sumup),shop=await import(shopModule);
  const as=id=>{globalThis.paypalBuyer=id?{userId:id,email:id==='owner'?'netsagee@gmail.com':id+'@example.test'}:null;};
  const post=(body,origin=site)=>new Request(site+'/checkout',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const cards=new Map(),remote=new Map(),requestIds=new Map(),captures=new Set(),returned=new Set();
  const configure={action:'connect-paypal',client:'fictional_client_id',secret:'fictional_secret_for_test'};
  let payee=merchant,distort=null,captureState='COMPLETED';
  t.mock.method(globalThis,'fetch',async(input,options)=>{
    const {origin,pathname}=new URL(input);
    if(origin==='https://api.sumup.com'){
      if(pathname.startsWith('/v1/merchants/'))return Response.json({merchant_code:'MTEST123',default_currency:'GBP',sandbox:false});
      if(options.method==='POST'){
        const record={...JSON.parse(options.body),id:crypto.randomUUID(),status:'PENDING'};
        cards.set(record.id,record);return Response.json(record);
      }
      const record=cards.get(pathname.split('/').pop());assert.ok(record);
      if(options.method==='DELETE')record.status='CANCELLED';
      return Response.json(record);
    }
    assert.equal(origin,'https://api-m.paypal.com');
    if(pathname==='/v1/oauth2/token'){
      assert.equal(options.headers.Authorization,'Basic '+Buffer.from(configure.client+':'+configure.secret).toString('base64'));
      return Response.json({access_token:'fixture-token'});
    }
    assert.equal(options.headers.Authorization,'Bearer fixture-token');
    const requestId=options.headers['PayPal-Request-Id'];
    if(pathname==='/v2/checkout/orders' && options.method==='POST'){
      const body=JSON.parse(options.body);
      if(requestIds.has(requestId))return Response.json(remote.get(requestIds.get(requestId)));
      const id='ORDER'+String(remote.size+1).padStart(12,'0');
      const order={...body,id,status:body.payment_source?'PAYER_ACTION_REQUIRED':'CREATED',
        purchase_units:body.purchase_units.map(u=>({...u,payee:{merchant_id:payee}})),links:[{rel:'payer-action',href:'https://www.paypal.com/checkoutnow?token='+id}]};
      requestIds.set(requestId,id);remote.set(id,order);
      return Response.json(order,{status:201});
    }
    if(pathname.endsWith('/capture')){
      const entity=remote.get(pathname.split('/')[4]);assert.ok(entity);assert.ok(requestId);
      if(entity.status==='COMPLETED')return new Response(null,{status:422});
      assert.equal(entity.status,'APPROVED');entity.status='COMPLETED';
      const unit=entity.purchase_units[0];
      unit.payments={captures:[{id:'CAP'+entity.id,status:captureState,amount:structuredClone(unit.amount)}]};captures.add(requestId);
      return Response.json(entity);
    }
    if(pathname.endsWith('/refund')){
      const captureId=pathname.split('/')[4];const capture=[...remote.values()].flatMap(r=>r.purchase_units[0].payments?.captures??[]).find(c=>c.id===captureId);
      assert.ok(capture);assert.ok(requestId);capture.status='REFUNDED';returned.add(requestId);
      return Response.json({status:'COMPLETED'});
    }
    assert.equal(options.method,'GET');const entity=structuredClone(remote.get(pathname.split('/').pop()));assert.ok(entity);
    if(distort)distort(entity);return Response.json(entity);
  });
  await t.test('only an owner can connect the verified business and no secret is returned',async()=>{
    assert.equal(await wallet.directPayPalStatus(),null);
    as('buyer');assert.equal((await staff.POST(post(configure))).status,403);
    as('owner');assert.equal((await staff.POST(post(configure,'https://other.example'))).status,403);
    assert.equal((await staff.POST(post(configure))).status,200);
    const settings=await (await staff.GET(new Request(site+'/api/payments'))).json();
    assert.equal(settings.paypalMerchant,merchant);
    for(const fields of [JSON.stringify(settings),(await db.prepare("SELECT value FROM settings WHERE id='paypal:business:v1'").first()).value]){
      assert.ok(!fields.includes(configure.client)&&!fields.includes(configure.secret));
    }
    payee='OTHERBUSINESS123';assert.equal((await staff.POST(post(configure))).status,400);payee=merchant;
    assert.equal(captures.size,0);
  });
  const buyCourse=id=>course.POST(post({courseId:id,provider:'paypal',amount:1}));
  const pay=(kind,id,origin)=>confirm.POST(post({kind,id},origin));
  await t.test('course approval, ownership, verified GBP capture and duplicate confirmations',async()=>{
    await db.prepare("INSERT INTO courses(id,title,description,level,price,published) VALUES('gel','Gel nails','Lesson','Beginner',4950,1)").run();
    const schedule={message:'Autumn training',dates:[{id:'autumn',date:'2099-09-12',start:'10:00',end:'16:00',status:'available',note:''}]};
    await db.prepare("INSERT INTO settings(id,value) VALUES('course-schedule:gel',?)").bind(JSON.stringify(schedule)).run();
    as('buyer');assert.equal((await buyCourse('gel')).status,409);
    const result=await course.POST(post({courseId:'gel',provider:'paypal',dateId:'autumn'}));assert.equal(result.status,200);
    const {path}=await result.json(),id=path.split('/').pop();
    assert.deepEqual(await (await course.POST(post({courseId:'gel',provider:'paypal',dateId:'autumn'}))).json(),{path});
    const date=JSON.parse((await db.prepare('SELECT value FROM settings WHERE id=?').bind('course-date:'+id).first()).value);
    assert.equal(date.id,'autumn');assert.match(date.label,/12 Sept 2099/);
    const saved=await db.prepare('SELECT session_id,status FROM orders WHERE id=?').bind(id).first();
    const order=remote.get(saved.session_id),unit=order.purchase_units[0];
    assert.equal(unit.amount.value,'49.50');assert.equal(unit.amount.currency_code,'GBP');
    assert.equal(order.payment_source.paypal.experience_context.return_url,site+path);
    assert.equal((await gateway.syncPayPalCourse(id)).approvalURL,'https://www.paypal.com/checkoutnow?token='+order.id);
    order.status='APPROVED';
    assert.equal((await gateway.syncPayPalCourse(id)).status,'pending');assert.equal(captures.size,0);
    as(null);assert.equal((await pay('course',id)).status,401);as('other');assert.equal((await pay('course',id)).status,404);
    as('buyer');assert.equal((await pay('course',id,'https://other.example')).status,403);
    for(const change of [r=>r.purchase_units[0].amount.value='0.01',r=>r.purchase_units[0].amount.currency_code='USD',
      r=>r.purchase_units[0].payee.merchant_id='OTHER',r=>r.purchase_units[0].custom_id='another-order']){
      distort=change;assert.equal((await pay('course',id)).status,503);assert.equal(captures.size,0);
    }
    distort=null;const results=await Promise.all([pay('course',id),pay('course',id)]);
    assert.ok(results.every(r=>r.status===200));assert.equal(captures.size,1);
    assert.equal((await db.prepare('SELECT status FROM orders WHERE id=?').bind(id).first()).status,'paid');
    assert.ok(await db.prepare("SELECT id FROM enrollments WHERE id='buyer/buyer/gel'").first());
  });
  await t.test('stock reservation, pending capture, confirmed order, full refund and one restock',async()=>{
    const d=await (await import(schema)).shopDatabase(),product=crypto.randomUUID(),variant=crypto.randomUUID();
    await d.prepare("INSERT INTO shop_delivery_methods(id,name,kind,price,active) VALUES('standard','UK delivery','delivery',350,1)").run();
    await d.prepare("INSERT INTO shop_products(id,title,description,price,published,updated_at) VALUES(?,'Gel kit','Practice',3900,1,'now')").bind(product).run();
    await d.prepare("INSERT INTO shop_variants(id,product_id,stock) VALUES(?,?,2)").bind(variant,product).run();
    const stock=async()=>(await d.prepare('SELECT stock FROM shop_variants WHERE id=?').bind(variant).first()).stock;
    const items=[{id:product,variantId:variant,quantity:1}],quote=await shop.quoteBasket({items}),id=crypto.randomUUID();
    const body={provider:'paypal',items,attempt:id,total:quote.total,delivery:{name:'Example Buyer',street:'1 Test Road',town:'Bath',postcode:'BA1 1AA',line2:''}};
    const sale=await checkout.POST(post(body));assert.equal(sale.status,200);
    const saved=await shop.shopOrder(id),order=remote.get(saved.session_id);
    assert.equal(order.purchase_units[0].shipping.address.country_code,'GB');
    assert.equal(order.purchase_units[0].amount.value,(quote.total/100).toFixed(2));
    assert.equal((await checkout.POST(post(body))).status,200);assert.equal(await stock(),1);
    as('other');assert.equal((await pay('shop',id)).status,404);as('buyer');
    order.status='APPROVED';captureState='PENDING';
    assert.equal((await pay('shop',id)).status,200);assert.equal((await shop.shopOrder(id)).status,'pending');
    order.purchase_units[0].payments.captures[0].status='COMPLETED';captureState='COMPLETED';
    assert.equal(await shop.syncShopOrder(id),'paid');
    assert.equal(await refunds.refundShopOrder(id,true),'refunded');assert.equal(await refunds.refundShopOrder(id,true),'refunded');
    assert.equal(returned.size,1);assert.equal(await stock(),2);
    const next=crypto.randomUUID();assert.equal((await checkout.POST(post({...body,attempt:next}))).status,200);
    const expired=await shop.shopOrder(next);remote.get(expired.session_id).status='APPROVED';
    await d.prepare('UPDATE shop_orders SET created_at=? WHERE id=?').bind(new Date(Date.now()-4*3600000).toISOString(),next).run();
    assert.equal((await pay('shop',next)).status,200);assert.equal((await shop.shopOrder(next)).status,'expired');
    assert.equal(await stock(),2);assert.equal(captures.size,2);
  });
  await t.test('changing course payment method closes the unused checkout before creating its replacement',async()=>{
    process.env.SUMUP_API_KEY='test-card-key';process.env.SUMUP_MERCHANT_CODE='MTEST123';
    as('buyer');await db.prepare("INSERT INTO courses(id,title,description,level,price,published) VALUES('art','Nail art','Lesson','Beginner',4500,1)").run();
    const open=async provider=>{
      const res=await course.POST(post({courseId:'art',provider}));assert.equal(res.status,200);
      return (await res.json()).path.split('/').pop();
    };
    const original=await open('sumup'),walletOrder=await open('paypal'),next=await open('sumup');
    assert.notEqual(original,walletOrder);assert.notEqual(next,original);
    const status=async id=>(await db.prepare('SELECT status FROM orders WHERE id=?').bind(id).first()).status;
    assert.equal(await status(original),'cancelled');assert.equal(await status(walletOrder),'expired');assert.equal(await status(next),'pending');
    assert.equal((await pay('course',walletOrder)).status,200);assert.equal(captures.size,2);
  });
});
