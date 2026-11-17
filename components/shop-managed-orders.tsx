'use client';
import {useState} from 'react';
import {gbp,type Delivery,type OrderLine} from '@/lib/shop-types';
import type {SaveShop} from './shop-product-editor';
export type ManagedOrder={id:string;email:string;created:string;items:OrderLine[];status:string;amount:number;dispatched:string|null;tracking:string|null;delivery:Delivery|null;method:string;methodKind:string;shipping:number;discountCode:string|null;discount:number;subtotal:number};
const stateName:Record<string,string>={paid:'Paid',pending:'Awaiting payment',refund_pending:'Refund awaiting confirmation',refunded:'Refunded',failed:'Payment failed',expired:'Expired',cancelled:'Cancelled'};
export default function ManagedOrderCard({order,busy,save}:{order:ManagedOrder;busy:boolean;save:SaveShop}) {
  const [refundOpen,setRefundOpen]=useState(false),collect=order.methodKind==='collection';
  const fulfilment=order.dispatched?(collect?'Collected':'Dispatched'):(collect?'Awaiting collection':'Awaiting dispatch');
  const status=(stateName[order.status]||order.status)+(order.status==='paid'?' · '+fulfilment:'');
  async function submit(e:React.FormEvent<HTMLFormElement>,action:string) {
    e.preventDefault();const form=new FormData(e.currentTarget);form.set('id',order.id);
    if(await save(action,form)) setRefundOpen(false);
  }
  return <details className="shop-order-card"><summary><span><strong>{order.email}</strong><small>{new Date(order.created).toLocaleDateString('en-GB',{timeZone:'Europe/London'})} · {status}</small></span><strong>{gbp(order.amount)}</strong></summary>
    <div className="shop-order-detail"><p>Order reference <code>{order.id}</code></p>
    <ul>{order.items.map((line,i)=><li key={i}>{line.quantity} × {line.title}{[line.colour,line.size].filter(Boolean).length?' · '+[line.colour,line.size].filter(Boolean).join(' / '):''} <strong>{gbp(line.price*line.quantity)}</strong></li>)}</ul>
    <p>Items {gbp(order.subtotal)} · {order.method} {gbp(order.shipping)}{order.discountCode&&' · '+order.discountCode+' −'+gbp(order.discount)}</p>
    {order.delivery&&<p>{[order.delivery.name,order.delivery.street,order.delivery.line2,order.delivery.town,order.delivery.postcode].filter(Boolean).join(', ')}</p>}
    {order.tracking&&<p>Tracking reference · {order.tracking}</p>}
    {order.status==='paid'&&!order.dispatched&&<form className="form" onSubmit={e=>submit(e,'dispatch')}>{!collect&&<label>Tracking reference (optional)<input name="tracking" maxLength={180}/></label>}
      <button disabled={busy} className="button">Mark as {collect?'collected':'dispatched'}</button></form>}
    {order.status==='paid'&&order.amount>0&&(refundOpen?<form className="form shop-refund" onSubmit={e=>submit(e,'refund')}>
      <h3>Refund {gbp(order.amount)} to the original payment method?</h3><p>This refunds the entire order through the original payment provider.</p>
      <label className="shop-check"><input type="checkbox" name="restock" value="1"/>Return these items to available stock</label>
      <input type="hidden" name="confirmed" value="1"/><div className="shop-admin-actions"><button className="button" disabled={busy}>Confirm refund of {gbp(order.amount)}</button>
        <button type="button" className="button outline" disabled={busy} onClick={()=>setRefundOpen(false)}>Cancel</button></div>
      </form>:<button className="underlink" type="button" disabled={busy} onClick={()=>setRefundOpen(true)}>Refund order</button>)}
    {order.status==='pending'&&<form onSubmit={e=>submit(e,'reconcile')}><button className="button outline" disabled={busy}>Check payment with provider</button></form>}
    {order.status==='refund_pending'&&<form className="form" onSubmit={e=>submit(e,'refundStatus')}><p>If the payment provider has already received the refund, check its status here. If the payment shows no refund after a connection interruption, review the transaction in the payment provider’s dashboard.</p><button className="button outline" disabled={busy}>Check refund with provider</button></form>}
    </div></details>;
}
