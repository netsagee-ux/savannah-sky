'use client';
import {useCallback,useEffect,useState} from 'react';
import {gbp,type Product,type Delivery,type OrderLine} from '@/lib/shop-types';
type Order={id:string;email:string;items:OrderLine[];status:string;amount:number;dispatched:string|null;tracking:string|null;delivery:Delivery|null};
type View={items:Product[];shipping:number|null;orders:Order[]};
export default function ShopManager({onChange}:{onChange:()=>Promise<void>}){
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [busy,setBusy]=useState(false),[editing,setEditing]=useState<Product|null>(null),[newId,setNewId]=useState('');
  const refresh=useCallback(async()=>{try{const r=await fetch('/api/shop/admin',{cache:'no-store'});if(!r.ok)throw Error('Could not load your shop.');setView(await r.json() as View);setError('');}catch(e){setError((e as Error).message);}},[]);
  useEffect(()=>{setNewId(crypto.randomUUID());void refresh();},[refresh]);
  async function save(e:React.FormEvent<HTMLFormElement>,action:string){
    e.preventDefault();if(busy)return;const fields=new FormData(e.currentTarget);fields.set('action',action);setBusy(true);setMessage('');
    try{const r=await fetch('/api/shop/admin',{method:'POST',body:fields});const result=await r.json() as {error?:string};if(!r.ok)throw Error(result.error);
      if(action==='product'){setEditing(null);setNewId(crypto.randomUUID());}
      setMessage(action==='dispatch'?'Order marked as dispatched.':'Changes saved.');await Promise.all([refresh(),onChange()]);
    }catch(e){setMessage((e as Error).message||'Please try again.');}finally{setBusy(false);}
  }
  return <>{error&&<p role="alert">{error} <button onClick={refresh}>Try again</button></p>}<p role="status">{message}</p>
    {!view?(!error&&<p>Loading shop…</p>):<><div className="admin-grid"><section id="shop-editor" className="admin-section"><h2>{editing?'Edit product':'Add a product'}</h2>
      <form key={editing?.id||newId} className="form" onSubmit={e=>save(e,'product')}><input type="hidden" name="id" value={editing?.id||newId}/>
        <label>Product name<input name="title" required defaultValue={editing?.title} maxLength={120}/></label>
        <label>Description<textarea name="description" rows={3} required defaultValue={editing?.description} maxLength={1500}/></label>
        <label>Price (£)<input name="price" required type="number" min=".50" max="10000" step=".01" defaultValue={editing?editing.price/100:''}/></label>
        <label>Product photo (up to 2 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label>
        <label>Availability<select name="published" defaultValue={editing?.published?'1':'0'}><option value="0">Hidden from shop</option><option value="1">Available to order</option></select></label>
        <button className="button" disabled={busy||!newId}>Save product</button>{editing&&<button type="button" className="underlink" onClick={()=>setEditing(null)}>Cancel editing</button>}
      </form></section><section className="admin-section"><h2>UK delivery</h2><p>One delivery charge applies to the whole basket. Enter £0 for free delivery.</p>
      <form className="form" onSubmit={e=>save(e,'postage')}><label>Delivery per order (£)<input name="postage" required type="number" min="0" max="10000" step=".01" defaultValue={view.shipping===null?'':view.shipping/100}/></label><button className="button outline" disabled={busy}>Save delivery</button></form>
      <h2>Your products</h2>{view.items.length?view.items.map(p=><div className="row" key={p.id}><span><strong>{p.title}</strong><br/>{gbp(p.price)} · {p.published?'Available':'Hidden'}</span><button className="edit-link" disabled={busy} onClick={()=>{setEditing(p);document.getElementById('shop-editor')?.scrollIntoView();}}>Edit</button></div>):<p>Add your first kit or supply.</p>}<a className="underlink" href="/shop">View shop</a></section></div>
      <section className="admin-section"><h2>Shop orders</h2>{view.orders.length?view.orders.map(o=><article key={o.id} className="shop-admin-order"><strong>{o.email}</strong><p>{o.items.map(l=>l.quantity+' × '+l.title).join(', ')} · {gbp(o.amount)}</p>
        <p>{o.dispatched?'Dispatched':o.status==='paid'?'Paid · awaiting dispatch':o.status} · {o.id}</p>
        {o.delivery&&<p>{[o.delivery.name,o.delivery.street,o.delivery.line2,o.delivery.town,o.delivery.postcode].filter(Boolean).join(', ')}</p>}
        {o.tracking&&<p>Tracking · {o.tracking}</p>}
        {o.status==='paid'&&!o.dispatched&&<form className="form" onSubmit={e=>save(e,'dispatch')}><input type="hidden" name="id" value={o.id}/><label>Tracking reference (optional)<input name="tracking" maxLength={180}/></label><button className="button" disabled={busy}>Mark dispatched</button></form>}
        {o.status==='pending'&&<form onSubmit={e=>save(e,'reconcile')}><input type="hidden" name="id" value={o.id}/><button className="underlink" disabled={busy}>Check SumUp status</button></form>}</article>):<p>Orders will appear here when a customer starts checkout.</p>}</section></>}</>;
}
