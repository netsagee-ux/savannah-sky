import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compile, moduleUrl} from './compile-fixture.mjs';

test('shop refunds bind the original transaction, survive duplicate requests, and restock only on confirmation', async t=>{
  const dir=await mkdtemp(join(tmpdir(),'academy-refunds-'));
  const env={TURSO_DATABASE_URL:'file:'+join(dir,'db'),TURSO_AUTH_TOKEN:'test',
    SUMUP_MERCHANT_CODE:'MTEST123',SUMUP_API_KEY:'refund-fixture'};
  const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  Object.assign(process.env,env);
  t.after(async()=>{for(const [k,v] of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;
    await rm(dir,{recursive:true,force:true});});

  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const db=(await import(adapter)).database();
  const server=moduleUrl('export {database as db} from '+JSON.stringify(adapter)+'; export const enrolmentOwner=""');
  const schema=await compile('lib/shop-schema.ts',{'./server':server});
  const gateway=await compile('lib/sumup.ts',{'./server':server,
    './course-orders':moduleUrl('export function recordVerifiedPayment(){}'),
    './course-invitation':moduleUrl('export function paidInvitationPath(){}')});
  const {refundShopOrder,reconcileShopRefund}=await import(await compile('lib/shop-refunds.ts',{'./shop-schema':schema,'./sumup':gateway}));
  await db.prepare('CREATE TABLE settings(id TEXT PRIMARY KEY,value TEXT)').run();
  await (await import(schema)).shopDatabase();
  const orders=new Map(),transactions=new Map();
  const stock=async p=>(await db.prepare('SELECT stock FROM shop_variants WHERE id=?').bind(p).first()).stock;
  const status=async id=>(await db.prepare('SELECT status FROM shop_orders WHERE id=?').bind(id).first()).status;
  async function newOrder(){
    const id=crypto.randomUUID(),txId=crypto.randomUUID(),session=crypto.randomUUID(),product=crypto.randomUUID();
    const items=[{id:product,title:'Brush',quantity:2,price:1000,variantId:product,colour:'',size:''}];
    await db.batch([
      db.prepare("INSERT INTO shop_products(id,title,description,price,published,updated_at) VALUES(?,'Brush','Brush',1000,1,'today')").bind(product),
      db.prepare('INSERT INTO shop_variants(id,product_id,stock) VALUES(?,?,5)').bind(product,product),
      db.prepare(`INSERT INTO shop_orders(id,user_id,email,items,shipping,amount,delivery,fingerprint,merchant,session_id,status,created_at)
        VALUES(?,'learner','qa@example.test',?,0,2000,'','',?,?,'paid','today')`).bind(id,JSON.stringify(items),env.SUMUP_MERCHANT_CODE,session),
      db.prepare('INSERT INTO shop_order_reservations(order_id,variant_id,quantity,tracked) VALUES(?,?,2,1)').bind(id,product),
    ]);
    const checkout={id:session,checkout_reference:id,merchant_code:env.SUMUP_MERCHANT_CODE,amount:20,currency:'GBP',status:'PAID',
      transactions:[{id:crypto.randomUUID(),status:'FAILED'},{id:txId,status:'SUCCESSFUL'}]};
    const tx={id:txId,merchant_code:env.SUMUP_MERCHANT_CODE,amount:20,currency:'GBP',status:'SUCCESSFUL',events:[]};
    const entry={id,txId,product,checkout,tx,posts:[],behaviour:'confirm'};
    orders.set(session,entry);transactions.set(txId,entry);
    return entry;
  }
  t.mock.method(globalThis,'fetch',async(url,opts)=>{
    const {pathname,searchParams}=new URL(url);
    assert.equal(opts.headers.Authorization,'Bearer '+env.SUMUP_API_KEY);
    if(pathname==='/v1/merchants/'+env.SUMUP_MERCHANT_CODE)
      return Response.json({merchant_code:env.SUMUP_MERCHANT_CODE,default_currency:'GBP',sandbox:false});
    if(pathname.startsWith('/v0.1/checkouts/'))return Response.json(orders.get(pathname.split('/').at(-1)).checkout);
    if(pathname==='/v2.1/merchants/'+env.SUMUP_MERCHANT_CODE+'/transactions'){
      assert.equal(opts.method,'GET');return Response.json(transactions.get(searchParams.get('id')).tx);
    }
    const match=pathname.match(/^\/v1\.0\/merchants\/MTEST123\/payments\/([\w-]+)\/refunds$/);
    assert.ok(match);assert.equal(opts.method,'POST');
    const o=transactions.get(match[1]),body=opts.body?JSON.parse(opts.body):null;
    o.posts.push(body);
    if(o.behaviour==='conflict')return new Response(null,{status:409});
    if(o.behaviour==='denied')return new Response(null,{status:403});
    if(o.behaviour==='timeout')throw new Error('network timeout');
    if(o.behaviour==='confirm'){
      o.tx.events.push({id:900,type:'REFUND',amount:body?.amount??20,status:'REFUNDED'});
      o.tx.status='REFUNDED';
    }
    return Response.json({},{status:201});
  });

  await t.test('two simultaneous full refunds send one request and put units back once',async()=>{
    const o=await newOrder();assert.equal(await stock(o.product),3);
    await Promise.all([refundShopOrder(o.id,true),refundShopOrder(o.id,true)]);
    assert.equal(await reconcileShopRefund(o.id),'refunded');
    assert.equal(await refundShopOrder(o.id,false),'refunded');assert.deepEqual(o.posts,[null]);
    assert.equal(await status(o.id),'refunded');assert.equal(await stock(o.product),5);
  });

  await t.test('separate permission failure unlocks the order, timeout and in-flight results never retransmit',async()=>{
    const o=await newOrder();o.behaviour='denied';
    await assert.rejects(refundShopOrder(o.id,false),/denied refund access/);assert.equal(await status(o.id),'paid');
    o.behaviour='conflict';await assert.rejects(refundShopOrder(o.id,false),/declined this refund/);
    assert.equal(await status(o.id),'paid');
    o.behaviour='timeout';
    assert.equal(await refundShopOrder(o.id,false),'refund_pending');assert.equal(await refundShopOrder(o.id,true),'refund_pending');
    assert.equal((await db.prepare("UPDATE shop_orders SET dispatched_at='now' WHERE id=? AND status='paid'").bind(o.id).run()).meta.changes,0);
    assert.equal(o.posts.length,3);
    o.tx.events=[{id:10,type:'REFUND',amount:20,status:'PENDING'}];assert.equal(await reconcileShopRefund(o.id),'refund_pending');
    o.tx.events[0].status='REFUNDED';assert.equal(await reconcileShopRefund(o.id),'refunded');
    assert.equal(await stock(o.product),3);assert.equal(o.posts.length,3);
  });

  await t.test('matching both lists counts a prior partial refund once and requests the balance',async()=>{
    const o=await newOrder();o.tx.status='REFUNDED';
    o.tx.events=[{id:25,type:'REFUND',status:'REFUNDED',amount:3.14}];
    o.tx.transaction_events=[{id:25,event_type:'REFUND',status:'REFUNDED',amount:3.14}];
    assert.equal(await refundShopOrder(o.id,false),'refunded');assert.deepEqual(o.posts,[{amount:16.86}]);
    assert.equal(await stock(o.product),3);
  });

  await t.test('watch an external pending partial refund before requesting the balance',async()=>{
    const o=await newOrder();
    o.tx.events=[{id:27,type:'REFUND',status:'PENDING',amount:2}];
    assert.equal(await refundShopOrder(o.id,true),'refund_pending');assert.equal(o.posts.length,0);
    o.tx.events[0].status='REFUNDED';
    await assert.rejects(reconcileShopRefund(o.id),/remaining balance/);assert.equal(await status(o.id),'paid');
    assert.equal(await refundShopOrder(o.id,true),'refunded');assert.deepEqual(o.posts,[{amount:18}]);
  });

  await t.test('only a new failed refund event allows another attempt',async()=>{
    const o=await newOrder();o.behaviour='timeout';
    o.tx.events=[{id:19,type:'REFUND',status:'FAILED',amount:20}];
    assert.equal(await refundShopOrder(o.id,false),'refund_pending');assert.equal(await reconcileShopRefund(o.id),'refund_pending');
    o.tx.events.push({id:20,type:'REFUND',status:'FAILED',amount:20});
    await assert.rejects(reconcileShopRefund(o.id),/refund failed/);assert.equal(await status(o.id),'paid');
  });

  await t.test('reject incorrect identity, ambiguous paid attempts, missing details, and zero totals',async()=>{
    const o=await newOrder();o.tx.currency='EUR';
    await assert.rejects(refundShopOrder(o.id,true),/does not match/);o.tx.currency='GBP';
    o.checkout.transactions.push({id:crypto.randomUUID(),status:'SUCCESSFUL'});
    await assert.rejects(refundShopOrder(o.id,true),/single payment/);o.checkout.transactions.pop();
    o.tx.simple_status='REFUNDED';await assert.rejects(refundShopOrder(o.id,true),/refunded amount/);
    await db.prepare('UPDATE shop_orders SET amount=0 WHERE id=?').bind(o.id).run();
    await assert.rejects(refundShopOrder(o.id,true),/no payment/);assert.deepEqual(o.posts,[]);
  });
});
