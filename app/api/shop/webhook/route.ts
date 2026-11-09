import {shopId,syncShopOrder} from '@/lib/shop';
import {SumUpError} from '@/lib/sumup';
export async function POST(req:Request){
  const id=new URL(req.url).searchParams.get('order')||'';
  if(!shopId.test(id))return new Response(null,{status:400});
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  if(body?.event_type!=='CHECKOUT_STATUS_CHANGED')return new Response(null,{status:204});
  if(typeof body.id!=='string'||!/^[\w-]{1,128}$/.test(body.id))return new Response(null,{status:400});
  try{await syncShopOrder(id,body.id);return new Response(null,{status:204});}
  catch(e){return new Response(null,{status:e instanceof SumUpError&&[404,409].includes(e.status)?400:503});}
}
