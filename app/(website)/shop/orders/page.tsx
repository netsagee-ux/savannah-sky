import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {buyerOrders} from '@/lib/shop';
import {gbp, type OrderLine, type ShopOrder} from '@/lib/shop-types';
import '../shop.css';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'My shop orders'};

function state(order: ShopOrder) {
  if (order.status === 'refunded') return 'Refunded';
  if (order.status === 'refund_pending') return 'Refund in progress';
  if (order.dispatched_at) return order.method_kind === 'collection' ? 'Collected' : 'Dispatched';
  if (order.status === 'pending') return 'Awaiting payment';
  if (order.status === 'paid') return order.amount ? 'Paid' : 'Confirmed';
  return order.status;
}

export default async function Orders() {
  const user = await requireChatGPTUser('/shop/orders');
  const orders = await buyerOrders(user.userId);
  return <section className="shop-receipt">
    <a className="underlink" href="/shop">Academy shop</a><h1>My shop orders</h1>
    {orders.length ? <ul>{orders.map(order => {
      const contents = (JSON.parse(order.items) as OrderLine[]).map(line =>
        [line.quantity + ' × ' + line.title, line.colour, line.size].filter(Boolean).join(' · ')).join(', ');
      return <li key={order.id}><a className="underlink" href={'/shop/orders/' + order.id}>{contents}</a>
        <p>{gbp(order.amount)} · {state(order)} · {new Date(order.created_at).toLocaleDateString('en-GB')}</p></li>;
    })}</ul> : <p>You haven’t placed a shop order yet.</p>}
  </section>;
}
