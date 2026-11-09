import {notFound} from 'next/navigation';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {deliveryFor,shopOrder,syncShopOrder} from '@/lib/shop';
import {gbp,type OrderLine} from '@/lib/shop-types';
import SumUpCard from '@/components/sumup-card';
import ShopOrderBasketReset from '@/components/shop-order-basket-reset';
import '../../shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Shop order'};
export default async function ShopReceipt({params}:{params:Promise<{id:string}>}){
  const {id}=await params,path='/shop/orders/'+encodeURIComponent(id),user=await requireChatGPTUser(path);
  let order=await shopOrder(id,user.userId);if(!order)notFound();let waiting=false;
  if(order.status==='pending'&&order.session_id){try{await syncShopOrder(id);order=await shopOrder(id,user.userId);}catch{waiting=true;}}
  if(!order)notFound();
  const lines=JSON.parse(order.items) as OrderLine[],to=deliveryFor(order);
  return <section className="shop-receipt"><a className="underlink" href="/shop/orders">My shop orders</a><h1>Your shop order</h1>
    <ul>{lines.map(l=><li key={l.id}>{l.quantity} × {l.title} · {gbp(l.price*l.quantity)}</li>)}</ul>
    <p>UK delivery · {gbp(order.shipping)}</p><h2>Total {gbp(order.amount)}</h2>
    <p>Deliver to {to.name}, {[to.street,to.line2,to.town,to.postcode].filter(Boolean).join(', ')}</p>
    {order.status==='paid'?<><h2>Payment confirmed</h2><p>{order.dispatched_at?'Your order has been dispatched.':'The academy is preparing your order.'}</p>{order.tracking&&<p>Tracking reference · {order.tracking}</p>}</>:
      waiting?<><p>Payment confirmation is taking longer than usual. Check this order again before paying.</p><a className="button" href={path}>Check again</a></>:
      order.status==='pending'&&order.session_id?<SumUpCard checkoutId={order.session_id}/>:<><p>{order.status==='pending'?'Return to your basket to finish setting up this payment.':'This checkout is '+order.status+'. You can start a new order from your basket.'}</p><a className="button" href="/shop#basket">Return to basket</a></>}
    {order.status!=='pending'&&<ShopOrderBasketReset id={id} paid={order.status==='paid'}/>}
    <p><small>Order reference {id}</small></p></section>;
}
