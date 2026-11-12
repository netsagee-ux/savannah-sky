'use client';
import Script from 'next/script';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';

type SDK={mount:(options:{id:string;checkoutId:string;locale:string;country:string;onResponse:(type:string)=>void})=>{unmount:()=>void}};
declare global {interface Window{SumUpCard?:SDK}}

export default function SumUpCard({checkoutId}:{checkoutId:string}){
  const [loaded,setLoaded]=useState(false),[notice,setNotice]=useState('');
  const host=useRef<HTMLDivElement>(null), router=useRouter();
  const [refreshing,startRefresh]=useTransition();
  const [checking,setChecking]=useState(false);
  useEffect(()=>{
    if(!loaded||!window.SumUpCard||!host.current)return;
    const widget=window.SumUpCard.mount({id:host.current.id,checkoutId,locale:'en-GB',country:'GB',onResponse(type){
      if(type==='success'){setChecking(true);setNotice('Checking your payment with SumUp…');router.refresh();}
      if(type==='fail'||type==='error'){setNotice('We could not confirm payment. Check the order before trying again.');router.refresh();}
    }});
    return ()=>widget?.unmount();
  },[loaded,checkoutId,router]);
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
  return <section aria-label="SumUp card payment">
    <Script src="https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js" strategy="afterInteractive" onReady={()=>setLoaded(true)} onError={()=>setNotice('The secure card form could not load. Refresh this page to try again.')}/>
    <div id="academy-sumup-card" ref={host}/>
    <p role="status">{notice||(!loaded?'Loading secure payment form…':'')}</p>
    <button className="underlink" type="button" disabled={refreshing} aria-busy={refreshing} onClick={()=>startRefresh(()=>router.refresh())}>{refreshing?'Checking payment…':'Check payment status'}</button>
  </section>;
}
