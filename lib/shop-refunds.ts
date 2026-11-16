import {shopDatabase} from './shop-schema';
import type {ShopOrder} from './shop-types';
import {
  checkoutMatches, checkoutMerchant, lookupMerchantCheckout, lookupMerchantTransaction,
  refundMerchantTransaction, SumUpError, type SumUpTransaction,
} from './sumup';

type RefundStatus = 'refund_pending' | 'refunded';
type Refund = {order_id:string; attempt:string; transaction_id:string; restock:number; previous_failures:string; observe_only:number};
type Database = Awaited<ReturnType<typeof shopDatabase>>;
type Merchant = Awaited<ReturnType<typeof checkoutMerchant>>;

async function refundDatabase() {
  const d=await shopDatabase();
  await d.prepare(`CREATE TABLE IF NOT EXISTS shop_refunds (
    order_id TEXT PRIMARY KEY REFERENCES shop_orders(id), attempt TEXT NOT NULL, transaction_id TEXT NOT NULL UNIQUE,
    restock INTEGER NOT NULL, previous_failures TEXT NOT NULL, observe_only INTEGER NOT NULL, requested_at TEXT NOT NULL, confirmed_at TEXT)`).run();
  return d;
}

async function orderFor(d:Database,id:string) {
  const order=await d.prepare('SELECT * FROM shop_orders WHERE id=?').bind(id).first<ShopOrder>();
  if(!order)throw new SumUpError('Shop order not found.',404);
  if(order.amount===0)throw new SumUpError('This order has no payment to refund.',409);
  if(!['paid','refund_pending','refunded'].includes(order.status)||!order.session_id)
    throw new SumUpError('Only a paid shop order can be refunded.',409);
  return order;
}

async function merchantFor(order:ShopOrder) {
  const merchant=await checkoutMerchant();
  if(merchant.code!==order.merchant)throw new SumUpError('Use the SumUp account that took this payment.',409);
  return merchant;
}

async function transactionIdFor(merchant:Merchant,order:ShopOrder) {
  const checkout=await lookupMerchantCheckout(merchant,order.session_id!);
  if(!checkoutMatches(checkout,order)||checkout.status!=='PAID')
    throw new SumUpError('SumUp could not confirm the original shop payment.',409);
  const attempts=checkout.transactions||[];
  const matches=attempts.filter(a=>['SUCCESSFUL','REFUNDED'].includes(a.status||'')).map(a=>a.id);
  // Older checkout responses can contain just the ID of the one transaction.
  if(!matches.length&&attempts.length===1&&!attempts[0].status)matches.push(attempts[0].id);
  if(checkout.transaction_id)matches.push(checkout.transaction_id);
  const ids=[...new Set(matches)];
  if(ids.length!==1||typeof ids[0]!=='string'||!/^[-\w]{1,128}$/.test(ids[0]))
    throw new SumUpError('SumUp could not identify a single payment for this order.',409);
  return ids[0];
}

function inspect(transaction:SumUpTransaction,order:ShopOrder,id:string) {
  if(transaction.id!==id||transaction.merchant_code!==order.merchant||transaction.currency!=='GBP'||
    !Number.isFinite(transaction.amount)||Math.abs(transaction.amount*100-order.amount)>0.000001)
    throw new SumUpError('The SumUp transaction does not match this shop order.',409);
  // SumUp may expose the same event in both the compact and detailed event lists.
  const events=new Map<number,{status:string;amount:number}>();
  for(const event of [...(transaction.events||[]),...(transaction.transaction_events||[])]) {
    if((event.event_type||event.type)!=='REFUND')continue;
    if(!Number.isSafeInteger(event.id)||!Number.isFinite(event.amount)||event.amount<0)
      throw new SumUpError('SumUp returned incomplete refund details. Check the transaction in SumUp.',409);
    events.set(event.id,event);
  }
  let confirmed=0, pending=false;
  const failures:number[]=[];
  for(const [id,event] of events) {
    if(['REFUNDED','SUCCESSFUL'].includes(event.status))confirmed+=Math.round(event.amount*100);
    else if(event.status==='FAILED')failures.push(id);
    else pending=true;
  }
  const eligible=['SUCCESSFUL','REFUNDED'].includes(transaction.status)&&
    !['CANCELLED','CHARGEBACK','NON_COLLECTION','FAILED'].includes(transaction.simple_status||'');
  if(confirmed>order.amount||(!confirmed&&!pending&&
    [transaction.status,transaction.simple_status].includes('REFUNDED')))
    throw new SumUpError('Check the refunded amount in SumUp before continuing.',409);
  return {confirmed,pending,eligible,failures};
}

async function complete(d:Database,refund:Refund):Promise<RefundStatus> {
  await d.batch([
    d.prepare(`UPDATE shop_orders SET status='refunded' WHERE id=? AND status='refund_pending'
      AND EXISTS (SELECT 1 FROM shop_refunds WHERE order_id=? AND attempt=?)`).bind(refund.order_id,refund.order_id,refund.attempt),
    d.prepare(`UPDATE shop_refunds SET confirmed_at=coalesce(confirmed_at,?) WHERE order_id=? AND attempt=?
      AND EXISTS(SELECT 1 FROM shop_orders WHERE id=shop_refunds.order_id AND status='refunded')`)
      .bind(new Date().toISOString(),refund.order_id,refund.attempt),
    d.prepare(`UPDATE shop_order_reservations SET restored=1 WHERE order_id=? AND restored=0
      AND EXISTS (SELECT 1 FROM shop_refunds WHERE order_id=? AND attempt=? AND restock=1 AND confirmed_at IS NOT NULL)`)
      .bind(refund.order_id,refund.order_id,refund.attempt),
  ]);
  const saved=await orderFor(d,refund.order_id);
  if(saved.status!=='refunded')throw new SumUpError('The refund changed. Check the current order status.',409);
  return 'refunded';
}

async function reject(d:Database,refund:Refund) {
  await d.batch([
    d.prepare(`UPDATE shop_orders SET status='paid' WHERE id=? AND status='refund_pending'
      AND EXISTS (SELECT 1 FROM shop_refunds WHERE order_id=? AND attempt=? AND confirmed_at IS NULL)`)
      .bind(refund.order_id,refund.order_id,refund.attempt),
    d.prepare(`DELETE FROM shop_refunds WHERE order_id=? AND attempt=? AND confirmed_at IS NULL
      AND EXISTS (SELECT 1 FROM shop_orders WHERE id=shop_refunds.order_id AND status='paid')`)
      .bind(refund.order_id,refund.attempt),
  ]);
}

export async function reconcileShopRefund(id:string):Promise<RefundStatus> {
  const d=await refundDatabase(),order=await orderFor(d,id);
  if(order.status==='refunded')return 'refunded';
  const refund=await d.prepare('SELECT * FROM shop_refunds WHERE order_id=?').bind(id).first<Refund>();
  if(order.status!=='refund_pending'||!refund)throw new SumUpError('There is no pending refund for this order.',409);
  const merchant=await merchantFor(order);
  const transaction=await lookupMerchantTransaction(merchant,refund.transaction_id);
  const state=inspect(transaction,order,refund.transaction_id);
  if(state.confirmed===order.amount)return complete(d,refund);
  const baseline:number[]=JSON.parse(refund.previous_failures);
  if(!state.pending&&state.failures.some(eventId=>!baseline.includes(eventId))) {
    await reject(d,refund);
    throw new SumUpError('SumUp reports that the refund failed. Review the transaction before trying again.',409);
  }
  if(refund.observe_only&&!state.pending) {
    await reject(d,refund);
    throw new SumUpError('The earlier SumUp refund has settled. Review the order and request the remaining balance if needed.',409);
  }
  return 'refund_pending';
}

export async function refundShopOrder(id:string,restock:boolean):Promise<RefundStatus> {
  const d=await refundDatabase(),order=await orderFor(d,id);
  if(order.status==='refunded')return 'refunded';
  if(order.status==='refund_pending')return reconcileShopRefund(id);
  const merchant=await merchantFor(order);
  const transactionId=await transactionIdFor(merchant,order);
  const transaction=await lookupMerchantTransaction(merchant,transactionId);
  const state=inspect(transaction,order,transactionId);
  if(!state.eligible&&state.confirmed!==order.amount)
    throw new SumUpError('This payment is not currently eligible for a refund in SumUp.',409);
  const claim:Refund={order_id:id,attempt:crypto.randomUUID(),transaction_id:transactionId,
    restock:restock?1:0,previous_failures:JSON.stringify(state.failures),observe_only:state.pending?1:0};
  const [inserted]=await d.batch([
    d.prepare(`INSERT INTO shop_refunds(order_id,attempt,transaction_id,restock,previous_failures,observe_only,requested_at)
      SELECT id,?,?,?,?,?,? FROM shop_orders WHERE id=? AND status='paid' ON CONFLICT(order_id) DO NOTHING`)
      .bind(claim.attempt,transactionId,claim.restock,claim.previous_failures,claim.observe_only,new Date().toISOString(),id),
    d.prepare(`UPDATE shop_orders SET status='refund_pending' WHERE id=? AND status='paid'
      AND EXISTS(SELECT 1 FROM shop_refunds WHERE order_id=? AND attempt=?)`).bind(id,id,claim.attempt),
  ]);
  if(!inserted.meta.changes)return reconcileShopRefund(id);
  if(state.confirmed===order.amount)return complete(d,claim);
  if(state.pending)return 'refund_pending';
  try {
    // A full refund is requested without a body; after external partial refunds request only the unpaid balance.
    await refundMerchantTransaction(merchant,transactionId,state.confirmed?order.amount-state.confirmed:undefined);
  } catch(error) {
    if(error instanceof SumUpError&&[400,401,403,404,409,422].includes(error.status)) {
      // A conflict can also mean someone has already refunded the same payment in the merchant dashboard.
      if(error.status===409||error.status===422) {
        let updated;
        try {updated=inspect(await lookupMerchantTransaction(merchant,transactionId),order,transactionId);}
        catch {return 'refund_pending';}
        if(updated.confirmed===order.amount)return complete(d,claim);
        if(updated.pending){
          await d.prepare('UPDATE shop_refunds SET observe_only=1 WHERE order_id=? AND attempt=?').bind(id,claim.attempt).run();
          return 'refund_pending';
        }
      }
      await reject(d,claim);
      throw new SumUpError(error.status===401||error.status===403?
        'SumUp denied refund access. Check the permissions on the connected merchant account.':
        'SumUp declined this refund. Check the transaction before trying again.',409);
    }
    // An interrupted response can follow a successful payment reversal. Keep the claim and use read-only reconciliation.
    return 'refund_pending';
  }
  return reconcileShopRefund(id);
}
