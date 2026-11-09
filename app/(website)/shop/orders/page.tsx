import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {buyerOrders} from '@/lib/shop';
import {gbp,type OrderLine} from '@/lib/shop-types';
import '../shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'My shop orders'};
export default async function Orders(){
  const user=await requireChatGPTUser('/shop/orders'),orders=await buyerOrders(user.userId);
  return <section className="shop-receipt"><a className="underlink" href="/shop">Academy shop</a><h1>My shop orders</h1>
    {orders.length?<ul>{orders.map(o=><li key={o.id}><a className="underlink" href={'/shop/orders/'+o.id}>{(JSON.parse(o.items) as OrderLine[]).map(l=>l.title).join(', ')}</a><p>{gbp(o.amount)} · {o.dispatched_at?'Dispatched':o.status} · {new Date(o.created_at).toLocaleDateString('en-GB')}</p></li>)}</ul>:<p>You haven’t placed a shop order yet.</p>}</section>;
}
