'use client';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function CheckoutButton({courseId, orderId}: {courseId: string; orderId?: string}) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function start() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/checkout', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({courseId, orderId, handoff:!orderId})});
      if (response.status === 401) {
        const back = orderId ? '/orders/'+encodeURIComponent(orderId) : '/courses/'+encodeURIComponent(courseId)+'#enrol';
        window.location.assign('/sign-in?redirect_url='+encodeURIComponent(back)); return;
      }
      const data = await response.json() as {url?:string; error?:string; enrolled?:boolean; orderId?:string};
      if (data.enrolled) {window.location.assign('/dashboard');return;}
      if (!response.ok || !data.url) throw Error(data.error || 'Please try again.');
      const next = new URL(data.url);
      if (next.protocol !== 'https:' || next.hostname !== (orderId ? 'checkout.stripe.com' : 'wa.me')) throw Error('The payment link could not be opened.');
      if (!orderId && data.orderId) {window.location.assign('/orders/'+encodeURIComponent(data.orderId)+'?handoff=1');return;}
      window.location.assign(next.href);
    } catch (e) {setError(e instanceof Error ? e.message : 'Please try again.');setBusy(false);}
  }
  return <><button type="button" className="button" disabled={busy} onClick={start}>{busy ? 'Opening…' : orderId ? 'Pay by card' : 'Order via WhatsApp'} <ArrowUpRight size={17}/></button>{error && <p role="alert">{error}</p>}</>;
}
