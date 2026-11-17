import {getChatGPTUser} from '@/app/chatgpt-auth';
import {sameSiteOrigin} from '@/lib/request-origin';
import {ownedOrder} from '@/lib/course-orders';
import {shopOrder,syncPayPalShop} from '@/lib/shop';
import {isPayPalMerchant} from '@/lib/paypal';
import {syncPayPalCourse} from '@/lib/sumup';

export async function POST(request:Request){
  if(!sameSiteOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in to confirm your payment.'},{status:401});
  const data=await request.json().catch(()=>null) as {kind?:unknown;id?:unknown}|null;
  if(!data||(data.kind!=='course' && data.kind!=='shop')||typeof data.id!=='string'||data.id.length>80)
    return Response.json({error:'Invalid order.'},{status:400});
  try{
    const order=data.kind==='shop'?await shopOrder(data.id,user.userId):await ownedOrder(data.id,user.userId);
    if(!order||('merchant' in order?!isPayPalMerchant(order.merchant):order.mode!=='paypal'))return Response.json({error:'Order unavailable.'},{status:404});
    if(order.status==='pending'){
      if('merchant' in order)await syncPayPalShop(order,true);else await syncPayPalCourse(order.id,true);
    }
    return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'PayPal could not confirm the payment yet. Check this order again before trying another payment.'},{status:503});}
}
