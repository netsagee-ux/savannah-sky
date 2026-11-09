import {admin} from '@/lib/server';
import {shopDatabase} from '@/lib/shop-schema';
import {products,deliveryFor,postage,shopId,syncShopOrder} from '@/lib/shop';
import type {ShopOrder} from '@/lib/shop-types';
import {imageContentType} from '@/lib/video-security';
const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private,no-store'}});
export async function GET(){
  if(!await admin())return reply({error:'Staff access required.'},403);
  try{
    const d=await shopDatabase();
    const [items,shipping,orders]=await Promise.all([products(true),postage(),d.prepare("SELECT * FROM shop_orders ORDER BY created_at DESC LIMIT 200").all<ShopOrder>()]);
    return reply({items,shipping,orders:orders.results.map(o=>({id:o.id,email:o.email,items:JSON.parse(o.items),amount:o.amount,status:o.status,
      dispatched:o.dispatched_at,tracking:o.tracking,delivery:o.status==='paid'?deliveryFor(o):null}))});
  }catch{return reply({error:'Shop management could not load.'},503);}
}
function pence(value:string,minimum:number){
  if(!/^\d{1,5}(\.\d{1,2})?$/.test(value))throw Error('Enter a GBP amount with up to two decimal places.');
  const n=Math.round(Number(value)*100);if(n<minimum||n>1000000)throw Error('Check the amount.');return n;
}
export async function POST(req:Request){
  if(req.headers.get('origin')!==new URL(req.url).origin||!await admin())return reply({error:'Staff access required.'},403);
  if(Number(req.headers.get('content-length')||0)>4*1024*1024)return reply({error:'Choose a photo under 2 MB.'},413);
  try{
    const f=await req.formData(),s=(k:string)=>String(f.get(k)||'').trim(),d=await shopDatabase();
    switch(s('action')){
      case 'postage':await d.prepare("INSERT INTO settings(id,value) VALUES('shop:postage',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(String(pence(s('postage'),0))).run();break;
      case 'product':{
        const id=s('id'),title=s('title'),description=s('description'),price=pence(s('price'),50);
        if(!shopId.test(id)||!title||title.length>120||!description||description.length>1500)throw Error('Add a product name and description.');
        let bytes:Uint8Array|null=null,mime:string|null=null;const file=f.get('photo');
        if(file instanceof File&&file.size){if(file.size>2*1024*1024)throw Error('Choose a photo under 2 MB.');bytes=new Uint8Array(await file.arrayBuffer());mime=imageContentType(bytes);if(!mime)throw Error('Use a JPG, PNG or WebP photo.');}
        await d.prepare(`INSERT INTO shop_products(id,title,description,price,published,photo,mime,updated_at) VALUES(?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,price=excluded.price,published=excluded.published,
          photo=coalesce(excluded.photo,shop_products.photo),mime=coalesce(excluded.mime,shop_products.mime),updated_at=excluded.updated_at`)
          .bind(id,title,description,price,s('published')==='1'?1:0,bytes,mime,new Date().toISOString()).run();break;
      }
      case 'reconcile':if(!shopId.test(s('id'))||!await syncShopOrder(s('id')))throw Error('Order not found.');break;
      case 'dispatch':{
        if(s('tracking').length>180)throw Error('Shorten the tracking reference.');
        const saved=await d.prepare("UPDATE shop_orders SET dispatched_at=?,tracking=? WHERE id=? AND status='paid' AND dispatched_at IS NULL").bind(new Date().toISOString(),s('tracking')||null,s('id')).run();
        if(!saved.meta.changes)throw Error('Only a paid order awaiting dispatch can be dispatched.');break;
      }
      default:throw Error('Unknown shop action.');
    }
    return reply({ok:true});
  }catch(e){return reply({error:(e as Error).message||'Could not save the changes.'},400);}
}
