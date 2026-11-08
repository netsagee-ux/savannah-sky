'use client';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';

type CheckoutResult = {url?: string; error?: string; enrolled?: boolean; orderId?: string; guest?: boolean; existingCardOrder?: string};

export default function CheckoutButton({courseId, orderId, guest = false}: {courseId: string; orderId?: string; guest?: boolean}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [handoff, setHandoff] = useState<{url: string; id: string} | null>(null);
  const intent = useRef('');
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const email = new FormData(event.currentTarget).get('email');
    if (!intent.current) {
      intent.current = crypto.randomUUID();
      try {
        const key = 'academy-order-intent/' + courseId;
        intent.current = sessionStorage.getItem(key) || intent.current;
        sessionStorage.setItem(key, intent.current);
      } catch { /* The current page can still retry when browser storage is unavailable. */ }
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/checkout', {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({courseId, orderId, handoff: !orderId, email, intent: intent.current})});
      const data: CheckoutResult = await response.json();
      if (data.enrolled) { window.location.assign('/dashboard'); return; }
      if (data.existingCardOrder) { window.location.assign('/orders/' + encodeURIComponent(data.existingCardOrder)); return; }
      if (response.status === 401) {
        const path = orderId ? '/orders/' + encodeURIComponent(orderId) : '/courses/' + encodeURIComponent(courseId) + '#enrol';
        window.location.assign('/sign-in?redirect_url=' + encodeURIComponent(path)); return;
      }
      if (!response.ok || !data.url) throw Error(data.error || 'Please try again.');
      const next = new URL(data.url);
      if (next.protocol !== 'https:' || next.hostname !== (orderId ? 'checkout.stripe.com' : 'wa.me')) throw Error('The payment link could not be opened.');
      if (!orderId && data.orderId) {
        if (!data.guest) { window.location.assign('/orders/' + encodeURIComponent(data.orderId) + '?handoff=1'); return; }
        setHandoff({url: next.href, id: data.orderId});
      }
      window.location.assign(next.href);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Please try again.');
    } finally { setBusy(false); }
  }
  if (handoff) return <div className="form"><p>Your order is ready. Send the prepared message in WhatsApp to arrange payment.</p>
    <a className="button" href={handoff.url}>Open WhatsApp <ArrowUpRight size={17}/></a>
    <a className="underlink" href={'/orders/' + encodeURIComponent(handoff.id)}>Check my order</a></div>;
  return <form className="form" onSubmit={start}>
    {guest && <label>Student email<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/></label>}
    <button type="submit" className="button" disabled={busy}>{busy ? 'Opening…' : orderId ? 'Pay by card' : 'Order via WhatsApp'} <ArrowUpRight size={17}/></button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
