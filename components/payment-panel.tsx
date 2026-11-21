'use client';
import {useEffect,useRef,useState} from 'react';
import CourseInvitationActions from './course-invitation-actions';
type Order={selected_date?:string|null;classroom:number;awaitingClaim:number;accessActive:number;receiptSent:number;id:string;email:string;title:string;amount:number;status:string;mode:string;created_at:string};
type Settings={paypalMerchant:string|null;receiptConfigured:boolean;merchant:{code:string|null;fromEnvironment:boolean};orders:Order[]};
const pounds=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'});

export default function PaymentPanel({onChange}:{onChange:()=>Promise<void>}){
 const [data,setData]=useState<Settings|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [search,setSearch]=useState(''),[applied,setApplied]=useState('');
 const [loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true);
 const latest=useRef(0);
 async function refresh(term=''){
   const ticket=++latest.current;
   setLoadError('');setLoading(true);
   try{
     const response=await fetch('/api/payments'+(term?'?order='+encodeURIComponent(term):''),{cache:'no-store'});
     const result=await response.json() as Settings & {error?:string};
     if(!response.ok)throw Error(response.status===403?'Your staff session has expired.':result.error);
     if(ticket===latest.current)setData(result);
   }catch(e){if(ticket===latest.current)setLoadError((e as Error).message||'Orders could not be loaded.');}
   finally{if(ticket===latest.current)setLoading(false);}
 }
 useEffect(()=>{void refresh();return ()=>{latest.current++;};},[]);
 async function save(body:object){
   setBusy(true);setMessage('');
   try{
     const response=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
     const result=await response.json() as {error?:string;message?:string};
     if(!response.ok)throw Error(result.error);
     setMessage(result.message||'Saved.');
     await Promise.all([refresh(applied),onChange()]);
     return true;
   }catch(e){setMessage((e as Error).message);return false;}
   finally{setBusy(false);}
 }
 return <><p role="status">{message}</p>
   {loadError&&<div role="alert">{loadError} <button type="button" className="underlink" onClick={()=>void refresh(applied)}>Try again</button>{' '}<a className="underlink" href="/sign-in?redirect_url=%2Fadmin%3Ftab%3DPayments">Sign in</a></div>}
   {!data?(loading&&<p role="status">Loading payments…</p>):<>
   <div className="admin-grid"><section className="admin-section"><h2>SumUp payments</h2>
     <p>{data.merchant.code?'Connected merchant · '+data.merchant.code:'Connect the existing academy merchant account to take card payments on this website.'}</p>
     {!data.merchant.fromEnvironment&&<details open={!data.merchant.code}><summary>{data.merchant.code?'Update secret key':'Connect merchant account'}</summary>
       <form className="form" onSubmit={async e=>{
         e.preventDefault();const form=e.currentTarget,fields=new FormData(form);
         if(await save({action:'connect-sumup',code:fields.get('code'),key:fields.get('key')}))form.reset();
       }}>
         <label>Merchant code<input name="code" defaultValue={data.merchant.code||''} required autoCapitalize="characters" spellCheck={false}/></label>
         <small>Use the code beside your business name in your <a href="https://me.sumup.com" target="_blank" rel="noreferrer">SumUp dashboard</a>.</small>
         <label>Secret API key<input name="key" type="password" autoComplete="new-password" required/></label>
         <small>In your live business profile, open Settings → For Developers → Toolkit → API Keys and create a secret key for the academy website.</small>
         <p>We’ll check that this account can create and confirm a GBP checkout. No card is charged.</p>
         <button className="button" disabled={busy}>Verify and save</button>
       </form></details>}
   </section><section className="admin-section"><h2>PayPal and Pay in 3</h2>
     <p>{data.paypalMerchant?'Connected to PayPal Business · '+data.paypalMerchant:'Connect the academy’s PayPal Business account to accept PayPal for courses and shop orders.'}</p>
     <details open={!data.paypalMerchant}><summary>{data.paypalMerchant?'Update live app credentials':'Connect PayPal'}</summary>
       <form className="form" onSubmit={async e=>{
         e.preventDefault();const form=e.currentTarget,fields=new FormData(form);
         if(await save({action:'connect-paypal',client:fields.get('client'),secret:fields.get('secret')}))form.reset();
       }}>
         <p>In the <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noreferrer">PayPal Developer Dashboard</a>, open Apps &amp; Credentials, choose Live and create or select the academy’s app.</p>
         <label>Live Client ID<input name="client" autoComplete="off" spellCheck={false} required/></label>
         <label>Live Secret<input name="secret" type="password" autoComplete="new-password" required/></label>
         <small>Verification creates an unpaid checkout to identify the receiving business. No money is taken.</small>
         <button className="button" disabled={busy}>Verify and connect PayPal</button>
       </form></details>
     <p>PayPal shows qualifying buyers their instalment amounts and dates before they agree.</p>
   </section></div>
   <section className="admin-section"><h2>Course orders</h2>
     <form className="form" onSubmit={e=>{e.preventDefault();const term=search.trim();setApplied(term);void refresh(term);}}>
       <label>Find by order reference or student email<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
       <div><button className="button outline">Find order</button>{applied&&<button type="button" className="underlink" onClick={()=>{setSearch('');setApplied('');void refresh();}}>Show recent orders</button>}</div>
     </form>
     {loading&&<p role="status">Loading orders…</p>}
     {!loading&&!loadError&&data.orders.map(order=>{
       const active=Boolean(order.accessActive||order.awaitingClaim);
       return <article className="payment-record" key={order.id}><h3>{order.title}</h3>{order.selected_date&&<p><strong>Preferred course date:</strong> {order.selected_date}</p>}
         <p>{order.email} · {pounds.format(order.amount/100)} · {order.status}</p>
         <small>{new Date(order.created_at).toLocaleDateString('en-GB')} · {order.mode==='sumup'?'SumUp':order.mode==='paypal'?'PayPal':order.mode==='test'?'Test':'Historical order'} · Ref {order.id}</small>
         {order.status==='paid' && order.mode!=='test' && (active?<><CourseInvitationActions id={order.id} email={order.email} title={order.title} classroom={Boolean(order.classroom)}/>
           {order.receiptSent?<small>Email accepted for sending</small>:data.receiptConfigured&&<button className="underlink" disabled={busy} onClick={()=>void save({action:'send-receipt',id:order.id})}>Send confirmation email</button>}</>:<small>Course access inactive</small>)}
         {Boolean(order.awaitingClaim)&&<button className="underlink" disabled={busy} onClick={()=>{if(confirm('Withdraw the unclaimed course invitation?'))void save({action:'withdraw-claim',id:order.id});}}>Withdraw invitation</button>}
         {order.status==='pending'&&['sumup','paypal'].includes(order.mode)&&<button className="button outline" disabled={busy} onClick={()=>void save({action:'verify-'+order.mode,id:order.id})}>Check with {order.mode==='paypal'?'PayPal':'SumUp'}</button>}
         {order.status==='pending'&&order.mode==='whatsapp'&&<button className="underlink" disabled={busy} onClick={()=>{if(confirm('Have you received '+pounds.format(order.amount/100)+' for this historical order?'))void save({action:'confirm-whatsapp',id:order.id});}}>Confirm earlier payment</button>}
         {order.status==='pending'&&['live','test'].includes(order.mode)&&<button className="underlink" disabled={busy} onClick={()=>void save({action:'reconcile',id:order.id})}>Check earlier card payment</button>}
       </article>;
     })}{!loading&&!loadError&&!data.orders.length&&<p>{applied?'No matching orders.':'No course orders yet.'}</p>}
   </section></>}</>;
}
