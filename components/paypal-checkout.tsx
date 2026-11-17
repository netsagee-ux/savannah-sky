'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
export default function PayPalCheckout({id,kind,amount,approvalURL,approved}:{id:string;kind:'course'|'shop';amount:number;approvalURL?:string|null;approved?:boolean}){
  const router=useRouter(),lock=useRef(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function capture(){
    if(lock.current)return;
    lock.current=true;setBusy(true);setMessage('');
    try{
      const response=await fetch('/api/paypal/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,kind}),signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw Error('We could not confirm this payment yet. Check the order status before trying again.');
      setMessage('Checking your payment confirmation.');router.refresh();
    }catch(e){setMessage((e as Error).message);}
    finally{setBusy(false);lock.current=false;}
  }
  return <section aria-label="PayPal checkout"><h2>Pay with PayPal</h2>
    {approved?<><p>You’ve approved the payment in PayPal. Confirm to complete this order.</p>
      <button type="button" className="button" disabled={busy} onClick={capture}>{busy?'Confirming…':'Confirm payment of £'+(amount/100).toFixed(2)}</button></>:
      approvalURL?<><p>{amount>=2000&&amount<=300000?'Eligible UK customers aged 18 or over may see a Pay in 3 offer in PayPal. Review your amounts, dates and terms before agreeing.':'Review your payment in your PayPal wallet.'}</p>
      <a className="button" href={approvalURL}>Continue to PayPal</a></>:<p>PayPal is processing this order.</p>}
    <p><button type="button" className="underlink" disabled={busy} onClick={()=>router.refresh()}>Check payment status</button></p>
    <a className="underlink" href="/payment-policy">Payments, cancellations and refunds</a><p role="status">{message}</p>
  </section>;
}
