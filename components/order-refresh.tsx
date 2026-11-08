'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrderRefresh({handoff}: {handoff?: string}) {
  const router = useRouter();
  useEffect(() => {
    if (handoff && new URLSearchParams(window.location.search).has('handoff')) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
      window.location.assign(handoff);
    }
    function refresh() { if (!document.hidden) router.refresh(); }
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [router,handoff]);
  return null;
}
