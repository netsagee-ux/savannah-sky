import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {shopDatabase} from './shop-schema';
import {SumUpError,checkoutMerchant,createMerchantCheckout,findMerchantCheckout,lookupMerchantCheckout,checkoutMatches} from './sumup';
import type {BasketLine,Delivery,DeliveryMethod,OrderLine,Product,ShopOrder,ShopQuote,Variant} from './shop-types';
import {sampleVisibility} from './shop-types';

export const shopId=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const orderSelect=`SELECT o.*,d.method_name,d.method_kind,d.discount_code,d.discount_amount
  FROM shop_orders o LEFT JOIN shop_order_details d ON d.order_id=o.id`;
export async function products(all=false,refreshStock=true):Promise<Product[]> {
  const database=await shopDatabase();
  if(refreshStock)await releaseOldHolds();
  const rows=await database.batch([
    database.prepare(`SELECT p.id,p.title,p.description,p.price,p.published,(p.photo IS NOT NULL) AS has_photo,
      p.updated_at,c.id AS category_id,c.name AS category FROM shop_products p
      LEFT JOIN shop_product_categories pc ON pc.product_id=p.id LEFT JOIN shop_categories c ON c.id=pc.category_id
      `+(all?'':'WHERE p.published IN (1, '+sampleVisibility+') ')+ 'ORDER BY p.title COLLATE NOCASE'),
    database.prepare(`SELECT v.* FROM shop_variants v JOIN shop_products p ON p.id=v.product_id `+
      (all?'':'WHERE p.published IN (1, '+sampleVisibility+') AND v.active=1 ')+'ORDER BY v.colour,v.size,v.id')
  ],'read');
  const grouped=new Map<string,Variant[]>();
  for(const v of rows[1].results as unknown as Variant[]){
    const list=grouped.get(v.product_id) || [];
    list.push(v);grouped.set(v.product_id,list);
  }
  return (rows[0].results as unknown as Product[]).map(product=>{
    const variants=grouped.get(product.id)||[];
    return {...product,variants};
  });
}
export async function deliveryMethods(all=false){
  const d=await shopDatabase();
  return (await d.prepare('SELECT * FROM shop_delivery_methods '+(all?'':'WHERE active=1 ')+
    "ORDER BY CASE id WHEN 'standard' THEN 0 ELSE 1 END,name COLLATE NOCASE").all<DeliveryMethod>()).results;
}
export async function postage(){
  return (await deliveryMethods()).find(m=>m.id==='standard')?.price??null;
}

function address(value:Partial<Delivery>|undefined,collection:boolean):Delivery{
  const field=(k:keyof Delivery,required=true)=>{const v=value?.[k];if(typeof v!=='string'||v.trim().length>150||(required&&!v.trim()))throw new SumUpError('Check the delivery name and address.',400);return v.trim();};
  if(collection)return {name:field('name'),street:'',line2:'',town:'',postcode:''};
  const postcode=field('postcode').toUpperCase().replace(/\s+/g,'');
  if(!/^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(postcode))throw new SumUpError('Enter a UK postcode.',400);
  return {name:field('name'),street:field('street'),line2:field('line2',false),town:field('town'),postcode:postcode.slice(0,-3)+' '+postcode.slice(-3)};
}
function deliveryKey(){
  if(!process.env.APP_ENCRYPTION_KEY)throw new SumUpError('Shop checkout is temporarily unavailable.');
  return createHash('sha256').update('academy-shop-delivery/v1/'+process.env.APP_ENCRYPTION_KEY).digest();
}
function seal(id:string,value:Delivery){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',deliveryKey(),iv);cipher.setAAD(Buffer.from(id));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');
}
export function deliveryFor(order:ShopOrder):Delivery{
  const b=Buffer.from(order.delivery,'base64'),cipher=createDecipheriv('aes-256-gcm',deliveryKey(),b.subarray(0,12));
  cipher.setAAD(Buffer.from(order.id));cipher.setAuthTag(b.subarray(12,28));
  return JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8'));
}
export async function shopOrder(id:string,userId?:string){
  return (await shopDatabase()).prepare(orderSelect+' WHERE o.id=?'+(userId?' AND o.user_id=?':''))
    .bind(...(userId?[id,userId]:[id])).first<ShopOrder>();
}
export async function buyerOrders(userId:string){
  return (await (await shopDatabase()).prepare(orderSelect+' WHERE o.user_id=? ORDER BY o.created_at DESC LIMIT 100').bind(userId).all<ShopOrder>()).results;
}
async function applyShopStatus(order:ShopOrder,checkout:Awaited<ReturnType<typeof lookupMerchantCheckout>>){
  if(!checkoutMatches(checkout,order))throw new SumUpError('Payment details do not match the shop order.',409);
  const status=checkout.status==='PAID'?'paid':['EXPIRED','FAILED','CANCELLED'].includes(checkout.status)?checkout.status.toLowerCase():'pending';
  const sql="UPDATE shop_orders SET session_id=?,status=?,paid_at=CASE WHEN ?='paid' THEN ? ELSE paid_at END WHERE id=? AND status='pending' AND (session_id IS NULL OR session_id=?)";
  await (await shopDatabase()).prepare(sql).bind(checkout.id,status,status,new Date().toISOString(),order.id,checkout.id).run();
  const saved=await shopOrder(order.id);
  if(!saved||saved.session_id!==checkout.id)throw new SumUpError('This checkout does not match the order.',409);
  return saved.status;
}

type BasketRequest = {items:BasketLine[];methodId?:string;discountCode?:string};
type Purchase = BasketRequest & {attempt:string;delivery:Delivery;total:number};
const hour=60*60*1000;

function validateCart(items:BasketLine[]){
  if(!Array.isArray(items)||!items.length||items.length>30)throw new SumUpError('Choose between 1 and 30 different items.',400);
  const seen=new Set<string>();
  return items.map(l=>{
    const variantId=l?.variantId??l?.id;
    if(!l||!shopId.test(l.id)||!shopId.test(variantId)||seen.has(variantId)||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>20)
      throw new SumUpError('Check the items and quantities in your basket.',400);
    seen.add(variantId);
    return {id:l.id,variantId,quantity:l.quantity};
  }).sort((a,b)=>a.variantId.localeCompare(b.variantId));
}
function options(body:BasketRequest){
  const methodId=body.methodId??'standard',raw=body.discountCode??'';
  if(typeof methodId!=='string'||methodId.length>80||typeof raw!=='string'||raw.length>80)
    throw new SumUpError('Check the delivery option and discount code.',400);
  return {methodId,discountCode:raw.trim().toUpperCase()};
}
async function releaseOldHolds(variants:string[]|null=null){
  const d=await shopDatabase();
  const suspended=await d.prepare(`SELECT DISTINCT o.id FROM shop_orders o JOIN shop_order_reservations r ON r.order_id=o.id
    WHERE o.status='pending' AND r.tracked=1 AND r.restored=0 AND o.created_at<?
    AND (? IS NULL OR r.variant_id IN (SELECT value FROM json_each(?))) ORDER BY o.created_at LIMIT 8`)
    .bind(new Date(Date.now()-hour-60000).toISOString(),variants?1:null,JSON.stringify(variants)).all<{id:string}>();
  // Only verified final provider states release stock; a temporary outage keeps the hold.
  await Promise.allSettled(suspended.results.map(o=>syncShopOrder(o.id)));
}
type QuoteMode='sale'|'sample'|'staff';
async function priceCart(cart:ReturnType<typeof validateCart>,methodId:string,discountCode:string,mode:QuoteMode='sale'){
  const d=await shopDatabase();
  const variants=cart.map(l=>l.variantId);
  const staff=Number(mode==='staff');
  const visibility=mode==='sample'?sampleVisibility:1;
  const read=()=>d.prepare(`SELECT v.*,p.price,p.title FROM shop_variants v JOIN shop_products p ON p.id=v.product_id
    WHERE (p.published=? OR ?=1) AND v.active=1 AND v.id IN (SELECT value FROM json_each(?))`).bind(visibility,staff,JSON.stringify(variants))
    .all<Variant&{price:number;title:string}>();
  let [rows,method,offer]=await Promise.all([read(),d.prepare('SELECT * FROM shop_delivery_methods WHERE id=? AND (active=1 OR ?=1)')
    .bind(methodId,staff).first<DeliveryMethod>(),discountCode?d.prepare('SELECT kind,value FROM shop_discounts WHERE code=? AND (active=1 OR ?=1)')
    .bind(discountCode,staff).first<{kind:'fixed'|'percent';value:number}>():null]);
  if(!method)throw new SumUpError('Choose an available delivery option.',409);
  if(discountCode&&!offer)throw new SumUpError('This discount code is unavailable. Check the code or remove it.',409);
  if(mode==='sale' && cart.some(l=>{const v=rows.results.find(r=>r.id===l.variantId);return v&&v.stock!==null&&v.stock<l.quantity;})){
    await releaseOldHolds(variants);rows=await read();
  }
  const tracked=new Set<string>();
  const lines:OrderLine[]=cart.map(l=>{
    const v=rows.results.find(v=>v.id===l.variantId && v.product_id===l.id);
    if(!v)throw new SumUpError('An item or variation is no longer available. Update your basket.',409);
    if(v.stock!==null){
      tracked.add(v.id);
      if(v.stock<l.quantity)throw new SumUpError(v.title+' · '+[v.colour,v.size].filter(Boolean).join(' ')+' has '+v.stock+' available. Update your basket.',409);
    }
    return {...l,title:v.title,price:v.price,colour:v.colour,size:v.size};
  });
  const subtotal=lines.reduce((sum,l)=>sum+l.price*l.quantity,0);
  const discount=offer?(offer.kind==='percent'?Math.round(subtotal*offer.value/100):Math.min(offer.value,subtotal)):0;
  const total=subtotal-discount+method.price;
  if(!Number.isSafeInteger(total)||total>1000000)throw new SumUpError('This order exceeds the shop checkout limit.',400);
  const quote:ShopQuote={lines,subtotal,discount,shipping:method.price,total,method,discountCode};
  return {quote,tracked};
}
export async function quoteBasket(body:BasketRequest,mode:QuoteMode='sale'){
  if(!body)throw new SumUpError('Check your basket.',400);
  const cart=validateCart(body.items),{methodId,discountCode}=options(body);
  return (await priceCart(cart,methodId,discountCode,mode)).quote;
}
function digest(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export async function startShopOrder(user:{userId:string;email:string},body:Purchase,origin:string){
  if(!body||!shopId.test(body.attempt)||!Number.isSafeInteger(body.total))throw new SumUpError('Check your basket before paying.',400);
  const cart=validateCart(body.items),{methodId,discountCode}=options(body);
  const id=body.attempt,path='/shop/orders/'+id,d=await shopDatabase();
  let order=await shopOrder(id);
  const method=order?null:await d.prepare('SELECT kind FROM shop_delivery_methods WHERE id=? AND active=1').bind(methodId).first<{kind:string}>();
  const to=address(body.delivery,(order?.method_kind??method?.kind)==='collection');
  const fingerprint=digest([cart,to,methodId,discountCode,body.total]);
  const legacyFingerprint=methodId==='standard'&&!discountCode&&cart.every(l=>l.id===l.variantId)
    ?digest([cart.map(({id,quantity})=>({id,quantity})),to,body.total]):null;
  function checkOwner(row:ShopOrder){
    if(row.user_id!==user.userId||(row.fingerprint!==fingerprint&&row.fingerprint!==legacyFingerprint))
      throw new SumUpError('Start a new checkout for this basket.',409);
  }
  if(order){
    checkOwner(order);
    if(order.status!=='pending'||order.session_id)return path;
  }
  // Retrying an existing attempt uses its immutable quote, even if it reserved the last item.
  const merchant=body.total>0?await checkoutMerchant():null;
  if(!order){
    try{
      const {quote,tracked}=await priceCart(cart,methodId,discountCode);
      if(quote.total!==body.total)throw new SumUpError('Prices or delivery have changed. Review your total.',409);
      const now=new Date().toISOString();
      await d.batch([
        d.prepare(`INSERT INTO shop_orders(id,user_id,email,items,shipping,amount,delivery,fingerprint,merchant,created_at,status,paid_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.userId,user.email,JSON.stringify(quote.lines),quote.shipping,quote.total,
            seal(id,to),fingerprint,merchant?.code??'',now,quote.total?'pending':'paid',quote.total?null:now),
        d.prepare(`INSERT INTO shop_order_details(order_id,method_id,method_name,method_kind,discount_code,discount_amount,subtotal)
          VALUES(?,?,?,?,?,?,?)`).bind(id,methodId,quote.method.name,quote.method.kind,discountCode||null,quote.discount,quote.subtotal),
        ...cart.map(l=>d.prepare('INSERT INTO shop_order_reservations(order_id,variant_id,quantity,tracked) VALUES(?,?,?,?)')
          .bind(id,l.variantId,l.quantity,tracked.has(l.variantId)?1:0))
      ]);
    }catch(error){
      const existing=await shopOrder(id);
      if(!existing){
        if(error instanceof Error&&/shop (item|quote|discount) changed/.test(error.message))
          throw new SumUpError('Stock or pricing changed. Please review your basket.',409);
        throw error;
      }
      checkOwner(existing);
    }
    order=await shopOrder(id);
  }
  if(!order)throw new SumUpError('Unable to save this order.');
  checkOwner(order);
  if(order.status!=='pending'||order.session_id)return path;
  if(!merchant||order.merchant!==merchant.code)throw new SumUpError('Refresh your order before continuing.',409);
  const end=new Date(Date.parse(order.created_at)+hour);
  if(end.getTime()<=Date.now()+20_000){await syncShopOrder(id);return path;}
  const checkout=await createMerchantCheckout(merchant,order,'Savannah Sky shop',origin,path,'/api/shop/webhook',end.toISOString());
  await applyShopStatus(order,checkout);
  return path;
}
export async function syncShopOrder(id:string,notified?:string){
  const order=await shopOrder(id);
  if(!order)return null;
  if(notified&&order.session_id&&notified!==order.session_id)throw new SumUpError('Wrong checkout for this order.',409);
  if(order.status!=='pending')return order.status;
  const checkoutId=order.session_id||notified;
  const expired=Date.parse(order.created_at)+hour+60000<Date.now();
  if(!checkoutId&&!expired)return 'pending';
  const merchant=await checkoutMerchant();
  if(order.merchant!==merchant.code)throw new SumUpError('Payment confirmation is temporarily unavailable.');
  const checkout=checkoutId?await lookupMerchantCheckout(merchant,checkoutId):await findMerchantCheckout(merchant,order);
  if(!checkout){
    const d=await shopDatabase();
    await d.prepare("UPDATE shop_orders SET status='expired' WHERE id=? AND status='pending' AND session_id IS NULL").bind(id).run();
    return (await shopOrder(id))?.status;
  }
  if(checkoutId&&checkout.id!==checkoutId)throw new SumUpError('Unexpected checkout.',409);
  return applyShopStatus(order,checkout);
}
