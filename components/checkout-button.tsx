'use client';
import {useState} from 'react';
export default function CheckoutButton({courseId}:{courseId:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function buy(){setBusy(true);setError('');try{
 const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseId})});
 if(r.status===401){window.location.assign('/sign-in?redirect_url='+encodeURIComponent('/courses/'+courseId));return;}
 const d=await r.json() as {error?:string;url?:string};if(!r.ok||!d.url)throw Error(d.error||'Checkout is unavailable. Please try again.');
 const url=new URL(d.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw Error('Unable to open secure checkout.');window.location.assign(url.href);
 }catch(e){setError((e as Error).message);setBusy(false);}}
 return <><button className="button" disabled={busy} onClick={buy}>{busy?'Opening Stripe…':'Buy course'}</button>{error&&<p role="alert">{error}</p>}</>;
}
