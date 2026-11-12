'use client';
import {useNavigationAction} from '@/hooks/use-navigation-action';
import {useEffect,useRef,useState} from 'react';
import {ShoppingBag,Plus,Minus,ArrowRight} from 'lucide-react';
import {gbp,type Product,type BasketLine} from '@/lib/shop-types';

export default function AcademyShop({items,shipping,ready,signedIn}:{items:Product[];shipping:number|null;ready:boolean;signedIn:boolean}){
  const [basket,setBasket]=useState<BasketLine[]>([]),[hydrated,setHydrated]=useState(false);
  const {busy,begin,finish}=useNavigationAction();
  const [message,setMessage]=useState('');
  const attempt=useRef({payload:'',id:''});
  useEffect(()=>{
    try{
      const saved=JSON.parse(sessionStorage.getItem('academy-basket')||'[]');
      if(Array.isArray(saved))setBasket(saved.filter(l=>typeof l?.id==='string'&&Number.isInteger(l.quantity)&&l.quantity>0&&l.quantity<=20));
    }catch{ /* Shopping still works when session storage is unavailable. */ }
    setHydrated(true);
  },[]);
  const products=new Map(items.map(product=>[product.id,product]));
  // A product may be withdrawn while a learner has the basket open.
  const cart=basket.filter(line=>products.has(line.id));
  const storedCart=JSON.stringify(cart);
  useEffect(()=>{
    if(hydrated)try{sessionStorage.setItem('academy-basket',storedCart);}catch{}
  },[storedCart,hydrated]);
  function change(id:string,delta:number){
    setBasket(old=>{
      const rows=old.filter(line=>products.has(line.id));
      const quantity=Math.min(20,(rows.find(line=>line.id===id)?.quantity||0)+delta);
      return [...rows.filter(line=>line.id!==id),...(quantity>0?[{id,quantity}]:[])];
    });
    setMessage('');
  }
  const subtotal=cart.reduce((sum,line)=>sum+products.get(line.id)!.price*line.quantity,0);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!cart.length||!begin())return;setMessage('');
    const fields=new FormData(e.currentTarget),delivery=Object.fromEntries(fields),total=subtotal+(shipping||0);
    const payload=JSON.stringify([cart,delivery,total]);
    try{
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
      const digest=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
      let previous=attempt.current;try{previous=JSON.parse(sessionStorage.getItem('academy-shop-attempt')||'null')||previous;}catch{}
      if(previous.payload!==digest)previous={payload:digest,id:crypto.randomUUID()};attempt.current=previous;
      try{sessionStorage.setItem('academy-shop-attempt',JSON.stringify(previous));}catch{}
      const res=await fetch('/api/shop/checkout',{method:'POST',signal:AbortSignal.timeout?.(45000),headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart,delivery,total,attempt:previous.id})});
      const data=await res.json() as {error?:string;path?:string};if(!res.ok||!data.path)throw Error(data.error);location.assign(data.path);
    }catch(e){setMessage((e as Error).message||'Unable to open checkout.');finish();}
  }
  return <div className="shop-layout"><section aria-label="Products" className="shop-products">{items.map(p=><article key={p.id}>
    {p.has_photo? <img loading="lazy" src={'/api/shop/photos/'+p.id+'?v='+encodeURIComponent(p.updated_at)} alt={p.title} width={480} height={360}/>:null}
    <div><h2>{p.title}</h2><strong>{gbp(p.price)}</strong></div><p>{p.description}</p>
    <button type="button" className="button outline" disabled={!hydrated||busy||cart.some(l=>l.id===p.id&&l.quantity>=20)} onClick={()=>change(p.id,1)}><Plus size={16}/> Add to basket</button>
  </article>)}</section><aside className="shop-basket" id="basket" aria-label="Your basket"><h2><ShoppingBag size={22}/> Your basket</h2>
    {cart.length?<><ul>{cart.map(l=>{const p=products.get(l.id)!;return <li key={p.id}><strong>{p.title}</strong><div className="shop-quantity">
      <button disabled={busy} type="button" aria-label={'Remove one '+p.title} onClick={()=>change(p.id,-1)}><Minus size={15}/></button>
      <span>{l.quantity}</span><button disabled={busy||l.quantity>=20} type="button" aria-label={'Add one '+p.title} onClick={()=>change(p.id,1)}><Plus size={15}/></button><span>{gbp(p.price*l.quantity)}</span></div></li>;})}</ul>
      <p>Subtotal <strong>{gbp(subtotal)}</strong></p><p>UK delivery <strong>{shipping===null?'To be confirmed':shipping?gbp(shipping):'Free'}</strong></p>
      {shipping!==null&&<p>Total <strong>{gbp(subtotal+shipping)}</strong></p>}
      {ready&&shipping!==null?(signedIn?<form className="form" onSubmit={submit}><h3>UK delivery address</h3>
        {([['name','Full name','name'],['street','Address line 1','address-line1'],['line2','Address line 2 (optional)','address-line2'],['town','Town or city','address-level2'],['postcode','Postcode','postal-code']] as const).map(([name,label,complete])=><label key={name}>{label}<input name={name} readOnly={busy} autoComplete={complete} maxLength={name==='postcode'?10:150} required={name!=='line2'}/></label>)}
        <button className="button" aria-busy={busy} disabled={busy}>{busy?'Opening payment…':'Continue to payment'} <ArrowRight size={16}/></button></form>:
          <a className="button" href="/sign-in?redirect_url=%2Fshop%23basket">Sign in to check out</a>):<p>Checkout opens when the academy finishes its payment and delivery settings.</p>}</>:<p>Your basket is empty.</p>}
    <p role="status">{message}</p></aside></div>;
}
