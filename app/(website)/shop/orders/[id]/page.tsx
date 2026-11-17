import {notFound} from 'next/navigation';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {deliveryFor, shopOrder, syncShopOrder, syncPayPalShop} from '@/lib/shop';
import {gbp, type OrderLine} from '@/lib/shop-types';
import {paypalWalletAvailability} from '@/lib/sumup';
import {isPayPalMerchant} from '@/lib/paypal';
import PayPalCheckout from '@/components/paypal-checkout';
import SumUpCard from '@/components/sumup-card';
import ShopOrderBasketReset from '@/components/shop-order-basket-reset';
import '../../shop.css';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Shop order'};

export default async function ShopReceipt({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const path = '/shop/orders/' + encodeURIComponent(id);
  const user = await requireChatGPTUser(path);
  let order = await shopOrder(id, user.userId);
  if (!order) notFound();
  let waiting = false;
  let wallet:Awaited<ReturnType<typeof syncPayPalShop>>|null=null;
  if (order.status === 'pending' && (order.session_id || isPayPalMerchant(order.merchant))) {
    try {
      if(isPayPalMerchant(order.merchant))wallet=await syncPayPalShop(order);
      else await syncShopOrder(id);
      order = await shopOrder(id, user.userId);
    } catch { waiting = true; }
  }
  if (!order) notFound();

  const lines = JSON.parse(order.items) as OrderLine[];
  const to = deliveryFor(order);
  const collection = order.method_kind === 'collection';
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const ordered = ['paid', 'refund_pending', 'refunded'].includes(order.status);
  return <section className="shop-receipt">
    <a className="underlink" href="/shop/orders">My shop orders</a><h1>Your shop order</h1>
    <ul>{lines.map(line => <li key={line.variantId || line.id}>
      <strong>{line.quantity} × {line.title}</strong>
      {[line.colour, line.size].some(Boolean) && <span className="shop-variation">{[line.colour, line.size].filter(Boolean).join(' / ')}</span>}
      <span>{gbp(line.price * line.quantity)}</span>
    </li>)}</ul>
    <dl className="shop-amounts">
      <div><dt>Subtotal</dt><dd>{gbp(subtotal)}</dd></div>
      {Boolean(order.discount_amount) && <div><dt>Discount{order.discount_code ? ' (' + order.discount_code + ')' : ''}</dt><dd>−{gbp(order.discount_amount || 0)}</dd></div>}
      <div><dt>{order.method_name || 'UK delivery'}</dt><dd>{order.shipping ? gbp(order.shipping) : 'Free'}</dd></div>
      <div className="shop-grand-total"><dt>Total</dt><dd>{gbp(order.amount)}</dd></div>
    </dl>
    <p>{collection ? 'Collection for ' + to.name : 'Deliver to ' + [to.name, to.street, to.line2, to.town, to.postcode].filter(Boolean).join(', ')}</p>
    {order.status === 'refunded' ? <><h2>Refunded</h2><p>The academy has refunded {gbp(order.amount)} for this order.</p></> :
      order.status === 'refund_pending' ? <><h2>Refund in progress</h2><p>The academy is checking the refund with the payment provider.</p></> :
      order.status === 'paid' ? <>
        <h2>{order.amount ? 'Payment confirmed' : 'Order confirmed'}</h2>
        <p>{order.dispatched_at ? collection ? 'The academy has marked this order as collected.' : 'Your order has been dispatched.' :
          collection ? 'The academy is preparing your order for collection.' : 'The academy is preparing your order.'}</p>
        {order.tracking && <p>Tracking reference · {order.tracking}</p>}
      </> : waiting ? <>
        <p>Payment confirmation is taking longer than usual. Check this order again before paying.</p>
        <a className="button" href={path}>Check again</a>
      </> : order.status === 'pending' && order.session_id && wallet ? <PayPalCheckout id={id} kind="shop" amount={order.amount} approvalURL={wallet.approvalURL} approved={'approved' in wallet && Boolean(wallet.approved)}/> :
      order.status === 'pending' && order.session_id ? <SumUpCard key={order.session_id} checkoutId={order.session_id} amountPence={order.amount} paypalAvailable={await paypalWalletAvailability(order.session_id)==='available'}/> : <>
        <p>{order.status === 'pending' ? 'Return to your basket to finish setting up this payment.' : 'This checkout is ' + order.status + '. You can start a new order from your basket.'}</p>
        <a className="button" href="/shop#basket">Return to basket</a>
      </>}
    {order.status !== 'pending' && <ShopOrderBasketReset id={id} paid={ordered}/>}
    <p><small>Order reference {id}</small></p>
  </section>;
}
