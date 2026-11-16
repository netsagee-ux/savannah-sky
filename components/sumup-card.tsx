'use client';
import Script from 'next/script';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';

type SDK={mount:(options:{id:string;checkoutId:string;locale:string;country:string;onPaymentMethodsLoad?:()=>string[];onResponse:(type:string)=>void})=>{unmount:()=>void}};
declare global {interface Window{SumUpCard?:SDK}}

export default function SumUpCard({checkoutId,amountPence,paypalAvailable}:{checkoutId:string;amountPence:number;paypalAvailable:boolean}){
  const [loaded,setLoaded]=useState(false),[notice,setNotice]=useState('');
  const [preferPayPal,setPreferPayPal]=useState(false);
  const [inProgress,setInProgress]=useState(false);
  const payPalOnly=paypalAvailable && preferPayPal;
  const inPayIn3Range=amountPence>=2000 && amountPence<=300000;
  const host=useRef<HTMLDivElement>(null), router=useRouter();
  const [refreshing,startRefresh]=useTransition();
  const [checking,setChecking]=useState(false);
  useEffect(()=>{
    if(!loaded||!window.SumUpCard||!host.current)return;
    const widget=window.SumUpCard.mount({id:host.current.id,checkoutId,locale:'en-GB',country:'GB',
      ...(payPalOnly?{onPaymentMethodsLoad:()=>['paypal']}:{}),
      onResponse(type){
      if(type==='sent'||type==='auth-screen'||type==='success')setInProgress(true);
      if(type==='invalid'||type==='fail'||type==='error')setInProgress(false);
      if(type==='success'){setChecking(true);setNotice('Checking your payment with SumUp…');router.refresh();}
      if(type==='fail'||type==='error'){setNotice('We could not confirm payment. Check the order before trying again.');router.refresh();}
    }});
    return ()=>widget?.unmount();
  },[loaded,checkoutId,router,payPalOnly]);
  useEffect(()=>{
    if(!checking)return;
    let attempts=0;
    const timer=setInterval(()=>{
      if(document.hidden)return;
      router.refresh();
      if(++attempts>=12){clearInterval(timer);setNotice('Confirmation is taking a little longer. Use Check payment status to try again.');}
    },5000);
    return ()=>clearInterval(timer);
  },[checking,router]);
  return <section aria-label="Secure checkout">
    {paypalAvailable && <div className="wallet-choice">
      {inPayIn3Range && <p>If you prefer to spread the cost, PayPal will show any Pay in 3 offer available to you before you confirm. This is credit for eligible UK residents aged 18 or over. Review the repayment dates and check that you can afford them.</p>}
      <button className="underlink" type="button" disabled={inProgress} onClick={()=>{setNotice('');setPreferPayPal(!payPalOnly);}}>
        {payPalOnly?'Show all payment methods':'Choose PayPal'}
      </button>
    </div>}
    <p><a className="underlink" href="/payment-policy" target="_blank" rel="noopener noreferrer">Payment, cancellation and refund policy (opens in a new tab)</a></p>
    <Script src="https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js" strategy="afterInteractive" onReady={()=>setLoaded(true)} onError={()=>setNotice('The secure payment form could not load. Refresh this page to try again.')}/>
    <div id="academy-sumup-card" ref={host}/>
    <p role="status">{notice||(!loaded?'Loading secure payment form…':'')}</p>
    <button className="underlink" type="button" disabled={refreshing} aria-busy={refreshing} onClick={()=>startRefresh(()=>router.refresh())}>{refreshing?'Checking payment…':'Check payment status'}</button>
  </section>;
}
