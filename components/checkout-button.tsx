'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function CheckoutButton({ courseId }: { courseId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function buy() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId }),
      });
      if (response.status === 401) {
        const returnTo = '/courses/' + encodeURIComponent(courseId) + '#enrol';
        window.location.assign('/sign-in?redirect_url=' + encodeURIComponent(returnTo));
        return;
      }
      const data = await response.json() as { enrolled?: boolean; error?: string; url?: string };
      if (data.enrolled) { window.location.assign('/dashboard'); return; }
      if (!response.ok || !data.url) throw Error(data.error || 'Please try checkout again.');
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw Error('Unable to open secure checkout.');
      window.location.assign(url.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try checkout again.');
      setBusy(false);
    }
  }

  return <><button className="button" type="button" disabled={busy} onClick={buy}>
    {busy ? 'Opening checkout…' : 'Continue to checkout'} <ArrowRight size={17} />
  </button>{error && <p className="checkout-error" role="alert">{error}</p>}</>;
}
