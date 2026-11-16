import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('shop quotes, reservations and catalogue administration',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'academy-inventory-'));
  const environment={TURSO_DATABASE_URL:'file:'+join(directory,'fixture.sqlite'),TURSO_AUTH_TOKEN:'fixture',
    APP_ENCRYPTION_KEY:'inventory-test',SUMUP_API_KEY:'fixture',SUMUP_MERCHANT_CODE:'MTEST123'};
  const previous=Object.fromEntries(Object.keys(environment).map(k=>[k,process.env[k]]));
  Object.assign(process.env,environment);
  t.after(async()=>{
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    delete globalThis.shopInventoryUser;
    await rm(directory,{recursive:true,force:true});
  });

  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const database=(await import(adapter)).database();
  const server=moduleUrl('export {database as db} from '+JSON.stringify(adapter)+
    ';export const admin=async()=>globalThis.shopInventoryUser?.userId==="owner";export const enrolmentOwner=""');
  const auth=moduleUrl('export const getChatGPTUser=async()=>globalThis.shopInventoryUser');
  const schema=await compile('lib/shop-schema.ts',{'./server':server});
  const gateway=await compile('lib/sumup.ts',{'./server':server,'./course-orders':moduleUrl('export function recordVerifiedPayment(){}'),
    './course-invitation':moduleUrl('export function paidInvitationPath(){}')});
  const shopTypes=await compile('lib/shop-types.ts',{});
  const shopModule=await compile('lib/shop.ts',{'./shop-schema':schema,'./sumup':gateway,'./shop-types':shopTypes});
  const shop=await import(shopModule);
  const adminModule=await compile('lib/shop-admin.ts',{'./shop-schema':schema,'./shop':shopModule,'./shop-types':shopTypes,
    './sumup':gateway,'./video-security':await compile('lib/video-security.ts',{})});
  const routes={'@/lib/request-origin':await compile('lib/request-origin.ts',{}),'@/lib/shop':shopModule,'@/lib/shop-schema':schema,'@/lib/shop-admin':adminModule,'@/lib/server':server,
    '@/lib/shop-refunds':moduleUrl('export function refundShopOrder(){};export function reconcileShopRefund(){}'),
    '@/lib/sumup':gateway,'@/app/chatgpt-auth':auth};
  const route=async p=>import(await compile('app/api/shop/'+p+'/route.ts',routes));
  const [admin,quote,checkout,webhook]=await Promise.all(['admin','quote','checkout','webhook'].map(route));
  const site='https://example.test';
  const post=(path,body)=>new Request(site+path,{method:'POST',headers:{origin:site,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const save=(action,fields,origin=site)=>{
    const form=new FormData();
    for(const [name,value] of Object.entries({action,...fields}))form.set(name,value);
    return admin.POST(new Request(site+'/api/shop/admin',{method:'POST',headers:{origin},body:form}));
  };
  const as=id=>{globalThis.shopInventoryUser=id?{userId:id,email:id+'@example.test'}:null;};
  const stock=async id=>(await database.prepare('SELECT stock FROM shop_variants WHERE id=?').bind(id).first()).stock;
  const quotes=body=>quote.POST(post('/api/shop/quote',body));
  const sampleQuote=body=>quote.POST(post('/api/shop/quote?sample=1',body));
  const buy=body=>checkout.POST(post('/api/shop/checkout',body));
  const remote=new Map();
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const {pathname,searchParams}=new URL(url);
    if(pathname==='/v1/merchants/MTEST123')return Response.json({merchant_code:'MTEST123',default_currency:'GBP',sandbox:false});
    if(pathname==='/v0.1/checkouts' && options.method==='POST'){
      const body=JSON.parse(options.body);
      if([...remote.values()].some(c=>c.checkout_reference===body.checkout_reference))return new Response(null,{status:409});
      const item={...body,id:crypto.randomUUID(),status:'PENDING'};
      remote.set(item.id,item);return Response.json(item);
    }
    if(pathname==='/v0.1/checkouts')return Response.json([...remote.values()].filter(c=>c.checkout_reference===searchParams.get('checkout_reference')));
    const payment=remote.get(pathname.split('/').pop());
    assert.ok(payment);return Response.json(payment);
  });
  async function notify(orderId,status){
    const saved=await shop.shopOrder(orderId);
    const payment=remote.get(saved.session_id);
    payment.status=status;
    return webhook.POST(post('/api/shop/webhook?order='+orderId,{event_type:'CHECKOUT_STATUS_CHANGED',id:payment.id}));
  }
  const legacy=crypto.randomUUID(),product=crypto.randomUUID(),red=crypto.randomUUID(),blue=crypto.randomUUID();
  const category=crypto.randomUUID(),collect=crypto.randomUUID();
  const originalProduct={id:product,title:'Gel kit',description:'Practice kit',price:'10.01',published:'1',category};
  const variants=[{id:red,colour:'Red',size:'Small',stock:1,active:1},{id:blue,colour:'Blue',size:'Large',stock:4,active:1}];
  const recipient={name:'Example Buyer',street:'1 Sample Road',line2:'',town:'Bath',postcode:'BA1 1AB'};

  await t.test('upgrades an old product and existing postage without changing either',async()=>{
    await database.batch([database.prepare('CREATE TABLE settings(id TEXT PRIMARY KEY,value TEXT)'),
      database.prepare("INSERT INTO settings(id,value) VALUES('shop:postage','350')"),
      database.prepare(`CREATE TABLE shop_products(id TEXT PRIMARY KEY,title TEXT,description TEXT,price INTEGER,published INTEGER,
        photo BLOB,mime TEXT,updated_at TEXT)`),
      database.prepare("INSERT INTO shop_products(id,title,description,price,published,updated_at) VALUES(?,'File','File',500,1,'legacy')").bind(legacy)]);
    const items=await shop.products();
    const p=items.find(p=>p.id===legacy);assert.equal(p.variants.length,1);
    assert.equal(p.variants[0].id,legacy);assert.equal(p.variants[0].stock,null);
    const q=await (await quotes({items:[{id:legacy,quantity:2}]})).json();
    assert.equal(q.total,1350);assert.equal(q.shipping,350);
  });

  await t.test('shop quotes accept the browser host behind the deployment proxy and reject other origins',async()=>{
    const send=origin=>quote.POST(new Request('http://internal.example/api/shop/quote',{method:'POST',
      headers:{origin,host:'academy.example','Content-Type':'application/json'},body:JSON.stringify({items:[{id:legacy,quantity:2}]})}));
    const accepted=await send('https://academy.example');
    assert.equal(accepted.status,200);assert.equal((await accepted.json()).total,1350);
    assert.equal((await send('https://elsewhere.example')).status,403);
  });

  await t.test('staff preview prices drafts without exposing them or changing shop stock',async()=>{
    const preview=await route('preview');
    const id=crypto.randomUUID(),option=crypto.randomUUID(),deliveryId=crypto.randomUUID();
    as('owner');
    assert.equal((await save('product',{id,title:'Sample kit',description:'Preview',price:'39',published:'0',
      originalVersion:'',originalStock:'[]',variants:JSON.stringify([{id:option,colour:'',size:'Starter',stock:6,active:1}])})).status,200);
    assert.equal((await save('delivery',{id:deliveryId,name:'Sample collection',kind:'collection',price:'0',active:'0'})).status,200);
    assert.equal((await save('discount',{code:'DEMO10',kind:'percent',value:'10',active:'0'})).status,200);
    const body={items:[{id,variantId:option,quantity:2}],methodId:deliveryId,discountCode:'DEMO10'};
    const quote=await preview.POST(post('/api/shop/preview',body));
    assert.equal(quote.status,200);assert.equal((await quote.json()).total,7020);assert.equal(await stock(option),6);
    assert.ok(!(await shop.products()).some(p=>p.id===id));
    assert.equal((await quotes({...body,preview:true})).status,409);
    as('learner');assert.equal((await preview.POST(post('/api/shop/preview',body))).status,403);
    as(null);assert.equal((await preview.POST(post('/api/shop/preview',body))).status,403);
  });
  await t.test('public samples show options anonymously and only become orderable when published for sale',async()=>{
    const id=crypto.randomUUID(),option=crypto.randomUUID();
    const fields={id,title:'Practice brush',description:'Sample brush',price:'12'};
    as('owner');
    assert.equal((await save('product',{...fields,published:'2',originalVersion:'',originalStock:'[]',
      variants:JSON.stringify([{id:option,colour:'',size:'7 mm',stock:8,active:1}])})).status,200);
    as(null);
    const sample=(await shop.products()).find(p=>p.id===id);
    assert.equal(sample.variants[0].size,'7 mm');
    assert.equal(sample.variants[0].stock,8);
    const body={items:[{id,variantId:option,quantity:1}],methodId:'standard'};
    const demo=await sampleQuote(body);
    assert.equal(demo.status,200);assert.equal((await demo.json()).total,1550);
    assert.equal((await sampleQuote({...body,discountCode:'DEMO10'})).status,409);
    assert.equal((await sampleQuote({...body,items:[{id,variantId:option,quantity:9}]})).status,409);
    assert.equal((await quotes(body)).status,409);
    as('buyer');
    assert.equal((await buy({...body,attempt:crypto.randomUUID(),delivery:recipient,total:1550})).status,409);
    assert.equal(await stock(option),8);
    as('owner');
    assert.equal((await save('product',{...fields,published:'1',originalVersion:sample.updated_at})).status,200);
    assert.equal((await quotes(body)).status,200);
    assert.equal((await sampleQuote(body)).status,409);
    assert.equal((await save('product',{...fields,published:'0'})).status,200);
    assert.ok(!(await shop.products()).some(p=>p.id===id));
    assert.equal((await sampleQuote(body)).status,409);
  });
  await t.test('staff can configure variations, collection, a category and coupons; other visitors cannot',async()=>{
    as('learner');assert.equal((await admin.GET()).status,403);
    assert.equal((await save('category',{id:category,name:'Kits'})).status,403);
    as('owner');assert.equal((await save('category',{id:category,name:'Kits'},'https://elsewhere.example')).status,403);
    assert.equal((await save('category',{id:category,name:'Kits'})).status,200);
    assert.equal((await save('delivery',{id:collect,name:'Salon collection',kind:'collection',price:'0',active:'1'})).status,200);
    assert.equal((await save('discount',{code:'KIT15',kind:'percent',value:'15',active:'1'})).status,200);
    assert.equal((await save('discount',{code:'FULL',kind:'fixed',value:'50',active:'1'})).status,200);
    assert.equal((await save('product',{...originalProduct,originalVersion:'',originalStock:'[]',variants:JSON.stringify(variants)})).status,200);
    const catalog=await shop.products();assert.equal(catalog.find(p=>p.id===product).category,'Kits');
    assert.deepEqual(catalog.find(p=>p.id===product).variants.map(v=>v.stock),[4,1]);
  });

  await t.test('two attempts to buy the last unit create one checkout; expiration releases it once',async()=>{
    as('buyer');
    const cart={items:[{id:product,variantId:red,quantity:1}],discountCode:' kit15 ',methodId:'standard'};
    const pricing=await (await quotes(cart)).json();
    assert.deepEqual([pricing.subtotal,pricing.discount,pricing.shipping,pricing.total],[1001,150,350,1201]);
    assert.equal((await buy({...cart,attempt:crypto.randomUUID(),delivery:recipient,total:851})).status,409);
    assert.equal(await stock(red),1);
    const attempts=[crypto.randomUUID(),crypto.randomUUID()];
    const responses=await Promise.all(attempts.map(attempt=>buy({...cart,attempt,delivery:recipient,total:1201})));
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
    const winner=attempts[responses.findIndex(r=>r.ok)];
    assert.equal(remote.size,1);assert.equal(await stock(red),0);
    assert.equal((await buy({...cart,attempt:winner,delivery:recipient,total:1201})).status,200);
    assert.equal(remote.size,1);assert.equal(await stock(red),0);
    assert.equal((await notify(winner,'EXPIRED')).status,204);
    assert.equal((await notify(winner,'EXPIRED')).status,204);
    assert.equal(await stock(red),1);assert.equal(await stock(blue),4);
  });

  await t.test('same-order retries preserve sibling variation quantities and prevent stale stock edits',async()=>{
    const catalog=await shop.products(true);
    const original=catalog.find(p=>p.id===product),attempt=crypto.randomUUID();
    const items=[{id:product,variantId:blue,quantity:2},{id:product,variantId:red,quantity:1}];
    const request={attempt,items,methodId:collect,discountCode:'KIT15',delivery:{name:'In person'},total:2553};
    as('buyer');const starts=await Promise.all([buy(request),buy(request)]);
    assert.deepEqual(starts.map(r=>r.status),[200,200]);
    assert.equal(await stock(blue),2);assert.equal(await stock(red),0);
    assert.equal([...remote.values()].filter(q=>q.checkout_reference===attempt).length,1);
    const order=await shop.shopOrder(attempt);assert.equal(order.method_kind,'collection');
    assert.equal(order.discount_amount,450);assert.equal(shop.deliveryFor(order).street,'');
    as('owner');
    const staleEdit=await save('product',{...originalProduct,originalVersion:original.updated_at,originalStock:JSON.stringify(original.variants),
      variants:JSON.stringify(variants)});
    assert.equal(staleEdit.status,409);
    assert.equal(await stock(blue),2);
    assert.equal((await notify(attempt,'PAID')).status,204);
    assert.equal((await notify(attempt,'PAID')).status,204);
    assert.equal(await stock(blue),2);
    assert.equal((await save('dispatch',{id:attempt,tracking:'COLLECTED'})).status,200);
  });

  await t.test('full discount with collection uses stock and completes without creating a card payment',async()=>{
    const items=[{id:product,variantId:blue,quantity:1}],attempt=crypto.randomUUID();
    as('buyer');
    assert.equal((await quotes({items,methodId:collect,discountCode:'INVALID'})).status,409);
    const q=await (await quotes({items,methodId:collect,discountCode:'FULL'})).json();
    assert.equal(q.discount,1001);assert.equal(q.total,0);
    const previous=remote.size;
    assert.equal((await buy({items,methodId:collect,discountCode:'FULL',attempt,total:0,delivery:{name:'Collector'}})).status,200);
    assert.equal((await shop.shopOrder(attempt)).status,'paid');
    assert.equal(remote.size,previous);assert.equal(await stock(blue),1);
  });

  await t.test('catalogue stock returns after an abandoned checkout expires at the provider',async()=>{
    as('buyer');
    const attempt=crypto.randomUUID(),cart={items:[{id:product,variantId:blue,quantity:1}],
      methodId:collect,attempt,total:1001,delivery:{name:'Collector'}};
    assert.equal((await buy(cart)).status,200);
    const order=await shop.shopOrder(attempt),payment=remote.get(order.session_id);
    await database.prepare('UPDATE shop_orders SET created_at=? WHERE id=?')
      .bind(new Date(Date.now()-2*60*60*1000).toISOString(),attempt).run();
    async function available(){
      const catalogue=await shop.products();
      return catalogue.find(p=>p.id===product).variants.find(v=>v.id===blue).stock;
    }
    assert.equal(await available(),0);
    payment.status='EXPIRED';
    assert.equal(await available(),1);
    assert.equal((await shop.shopOrder(attempt)).status,'expired');
    assert.equal(await available(),1);
  });

});
