'use client';
import {useNavigationAction} from '@/hooks/use-navigation-action';
import {useState} from 'react';

export default function CheckoutButton({courseId,paypal=false,card=true}:{courseId:string;paypal?:boolean;card?:boolean}){
  const {busy,begin,finish}=useNavigationAction();
  const [error,setError]=useState('');
  async function start(provider:'sumup'|'paypal'){
    if(!begin())return;
    setError('');
    try {
      const response=await fetch('/api/checkout',{method:'POST',signal:AbortSignal.timeout?.(45000),headers:{'Content-Type':'application/json'},body:JSON.stringify({courseId,provider})});
      if(response.status===401){location.assign('/sign-in?redirect_url='+encodeURIComponent('/courses/'+courseId+'#enrol'));return;}
      const result=await response.json() as {path?:string;error?:string};
      if(!response.ok||!result.path)throw Error(result.error||'Please try again.');
      location.assign(result.path);
    } catch(e){setError((e as Error).message);finish();}
  }
  return <>{card&&<button className="button" type="button" aria-busy={busy} disabled={busy} onClick={()=>start('sumup')}>{busy?'Opening checkout…':paypal?'Pay by card':'Continue to payment'}</button>}{paypal&&<button className="button outline" type="button" disabled={busy} onClick={()=>start('paypal')}>Pay with PayPal</button>}{error&&<p role="alert">{error}</p>}</>;
}
