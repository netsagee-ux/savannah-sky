'use client';
import {useEffect} from 'react';

export default function ShopOrderBasketReset({id, paid}: {id: string; paid: boolean}) {
  useEffect(() => {
    try {
      const attempt = JSON.parse(sessionStorage.getItem('academy-shop-attempt') || 'null');
      if (attempt?.id !== id) return;
      sessionStorage.removeItem('academy-shop-attempt');
      // An older receipt can be revisited after the shopper edits their basket.
      if (paid && (!attempt.basket || attempt.basket === sessionStorage.getItem('academy-basket'))) {
        sessionStorage.removeItem('academy-basket');
        sessionStorage.removeItem('academy-shop-choices');
      }
    } catch { /* The receipt remains accessible with storage disabled. */ }
  }, [id, paid]);
  return null;
}
