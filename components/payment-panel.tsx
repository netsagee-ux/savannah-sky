'use client';
import {useEffect,useState} from 'react';
import CourseInvitationActions from './course-invitation-actions';
type Order={awaitingClaim:number;accessActive:number;receiptSent:number;id:string;email:string;title:string;amount:number;status:string;mode:string;created_at:string};
type Settings={receiptConfigured:boolean;merchant:{code:string|null;fromEnvironment:boolean};canManageStaff:boolean;staffEmail:string;orders:Order[]};
const pounds=new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'});

export default function PaymentPanel({onChange}:{onChange:()=>Promise<void>}){
 const [data,setData]=useState<Settings|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [search,setSearch]=useState(''),[applied,setApplied]=useState('');
 async function refresh(term=''){
   try{
     const response=await fetch('/api/payments'+(term?'?order='+encodeURIComponent(term):''),{cache:'no-store'});
     const result=await response.json() as Settings & {error?:string};
     if(!response.ok)throw Error(result.error);
     setData(result);
   }catch(e){setMessage((e as Error).message);}
 }
 useEffect(()=>{void refresh();},[]);
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
 return <><p role="status">{message}</p>{!data?<p>Loading payments…</p>:<>
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
   </section>{data.canManageStaff&&<section className="admin-section"><h2>Staff access</h2>
     <p>The approved educator can manage courses, upload videos and review sales. They sign in with their own verified email.</p>
     <form className="form" onSubmit={e=>{e.preventDefault();void save({action:'staff-access',email:new FormData(e.currentTarget).get('email')});}}>
       <label>Educator email<input key={data.staffEmail} name="email" type="email" required defaultValue={data.staffEmail}/></label>
       <button className="button" disabled={busy}>Save staff access</button>
       {data.staffEmail&&<button className="underlink" disabled={busy} type="button" onClick={()=>{if(confirm('Remove staff access for '+data.staffEmail+'?'))void save({action:'staff-access',email:''});}}>Remove educator access</button>}
     </form></section>}</div>
   <section className="admin-section"><h2>Course orders</h2>
     <form className="form" onSubmit={e=>{e.preventDefault();const term=search.trim();setApplied(term);void refresh(term);}}>
       <label>Find by order reference or student email<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
       <div><button className="button outline">Find order</button>{applied&&<button type="button" className="underlink" onClick={()=>{setSearch('');setApplied('');void refresh();}}>Show recent orders</button>}</div>
     </form>
     {data.orders.map(order=>{
       const active=Boolean(order.accessActive||order.awaitingClaim);
       return <article className="payment-record" key={order.id}><h3>{order.title}</h3>
         <p>{order.email} · {pounds.format(order.amount/100)} · {order.status}</p>
         <small>{new Date(order.created_at).toLocaleDateString('en-GB')} · {order.mode==='sumup'?'SumUp':order.mode==='test'?'Test':'Historical order'} · Ref {order.id}</small>
         {order.status==='paid' && order.mode!=='test' && (active?<><CourseInvitationActions id={order.id} email={order.email} title={order.title}/>
           {order.receiptSent?<small>Email accepted for sending</small>:data.receiptConfigured&&<button className="underlink" disabled={busy} onClick={()=>void save({action:'send-receipt',id:order.id})}>Send confirmation email</button>}</>:<small>Course access inactive</small>)}
         {Boolean(order.awaitingClaim)&&<button className="underlink" disabled={busy} onClick={()=>{if(confirm('Withdraw the unclaimed course invitation?'))void save({action:'withdraw-claim',id:order.id});}}>Withdraw invitation</button>}
         {order.status==='pending'&&order.mode==='sumup'&&<button className="button outline" disabled={busy} onClick={()=>void save({action:'verify-sumup',id:order.id})}>Check with SumUp</button>}
         {order.status==='pending'&&order.mode==='whatsapp'&&<button className="underlink" disabled={busy} onClick={()=>{if(confirm('Have you received '+pounds.format(order.amount/100)+' for this historical order?'))void save({action:'confirm-whatsapp',id:order.id});}}>Confirm earlier payment</button>}
         {order.status==='pending'&&['live','test'].includes(order.mode)&&<button className="underlink" disabled={busy} onClick={()=>void save({action:'reconcile',id:order.id})}>Check earlier card payment</button>}
       </article>;
     })}{!data.orders.length&&<p>{applied?'No matching orders.':'No course orders yet.'}</p>}
   </section></>}</>;
}
