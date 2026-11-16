import {sameSiteOrigin} from '@/lib/request-origin';
import {admin} from '@/lib/server';
import {shopDatabase} from '@/lib/shop-schema';
import {products,deliveryFor,deliveryMethods,shopId,syncShopOrder} from '@/lib/shop';
import {saveProduct,manageShopSetting} from '@/lib/shop-admin';
import {refundShopOrder,reconcileShopRefund} from '@/lib/shop-refunds';
import {SumUpError} from '@/lib/sumup';
import type {ShopOrder} from '@/lib/shop-types';

const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private,no-store'}});
const pageSize=30;
const filters:Record<string,string>={
  waiting:"o.status='paid' AND o.dispatched_at IS NULL", dispatched:"o.status='paid' AND o.dispatched_at IS NOT NULL",
  pending:"o.status='pending'", refunds:"o.status IN ('refund_pending','refunded')",
};
type Detail=ShopOrder&{method_name:string|null;method_kind:string|null;discount_code:string|null;discount_amount:number|null;subtotal:number|null};
export async function GET(req:Request) {
  if(!await admin()) return reply({error:'Staff access required.'},403);
  try {
    const d=await shopDatabase(),params=req?new URL(req.url).searchParams:new URLSearchParams();
    const page=Number(params.get('page')||1),filter=params.get('filter')||'';
    if(!Number.isSafeInteger(page)||page<1||page>100000 || (filter && !Object.hasOwn(filters,filter)))return reply({error:'Invalid order filter.'},400);
    const where=filter?' WHERE '+filters[filter]:'';
    const [items,methods,categories,discounts,count]=await Promise.all([products(true),deliveryMethods(true),
      d.prepare('SELECT id,name FROM shop_categories ORDER BY name COLLATE NOCASE').all(),
      d.prepare('SELECT code,kind,value,active FROM shop_discounts ORDER BY active DESC, code').all(),
      d.prepare('SELECT COUNT(*) AS total FROM shop_orders o'+where).first<{total:number}>()]);
    const total=count?.total||0,current=Math.min(page,Math.max(1,Math.ceil(total/pageSize)));
    const rows=await d.prepare(`SELECT o.*,s.method_name,s.method_kind,s.discount_code,s.discount_amount,s.subtotal
      FROM shop_orders o LEFT JOIN shop_order_details s ON s.order_id=o.id`+where+
      ' ORDER BY o.created_at DESC,o.id DESC LIMIT ? OFFSET ?').bind(pageSize,(current-1)*pageSize).all<Detail>();
    return reply({items,methods,categories:categories.results,discounts:discounts.results,page:current,pageSize,total,
      shipping:methods.find(m=>m.id==='standard'&&m.active)?.price??null,
      orders:rows.results.map(o=>({id:o.id,email:o.email,created:o.created_at,items:JSON.parse(o.items),amount:o.amount,status:o.status,
        dispatched:o.dispatched_at,tracking:o.tracking,delivery:['paid','refund_pending','refunded'].includes(o.status)?deliveryFor(o):null,
        method:o.method_name||'UK delivery',methodKind:o.method_kind||'delivery',shipping:o.shipping,
        discountCode:o.discount_code,discount:o.discount_amount||0,subtotal:o.subtotal??o.amount-o.shipping}))});
  } catch {return reply({error:'Shop management could not load.'},503);}
}
export async function POST(req:Request) {
  if(!sameSiteOrigin(req) || !await admin()) return reply({error:'Staff access required.'},403);
  if(Number(req.headers.get('content-length')||0)>4*1024*1024) return reply({error:'Choose a photo under 2 MB.'},413);
  try {
    const form=await req.formData(),action=String(form.get('action')||''),id=String(form.get('id')||'');
    if(action==='product') await saveProduct(form);
    else if(['postage','category','removeCategory','delivery','discount'].includes(action)) await manageShopSetting(form,action);
    else {
      if(!shopId.test(id)) throw new SumUpError('Choose an existing order.',400);
      if(action==='reconcile') {
        if(!await syncShopOrder(id)) throw new SumUpError('Order not found.',400);
      } else if(action==='dispatch') {
        const tracking=String(form.get('tracking')||'').trim();
        if(tracking.length>180) throw new SumUpError('Shorten the tracking reference.',400);
        const d=await shopDatabase();
        const saved=await d.prepare("UPDATE shop_orders SET dispatched_at=?,tracking=? WHERE id=? AND status='paid' AND dispatched_at IS NULL")
          .bind(new Date().toISOString(),tracking||null,id).run();
        if(!saved.meta.changes) throw new SumUpError('Only a paid order awaiting fulfilment can be marked complete.',400);
      } else if(action==='refund') {
        if(form.get('confirmed')!=='1') throw new SumUpError('Confirm the full refund first.',400);
        const result=await refundShopOrder(id,form.get('restock')==='1');
        return reply({ok:true,message:result==='refunded'?'Refund confirmed by SumUp.':'Refund submitted. Check the order for confirmation.'});
      } else if(action==='refundStatus') {
        const result=await reconcileShopRefund(id);
        return reply({ok:true,message:result==='refunded'?'Refund confirmed by SumUp.':'Check the refund status shown on the order.'});
      } else throw new SumUpError('Unknown shop action.',400);
    }
    return reply({ok:true});
  } catch(e) {
    if(e instanceof SumUpError)return reply({error:e.message},e.status);
    if(/unique constraint/i.test(String(e))) return reply({error:'That name or code already exists. Edit the existing entry instead.'},409);
    return reply({error:'Could not save the changes. Refresh the shop and try again.'},503);
  }
}
