'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {gbp,type Product} from '@/lib/shop-types';
import ShopProductEditor,{type SaveShop} from './shop-product-editor';
import {ShopSettings,type ShopCategory,type ShopMethod,type ShopDiscount} from './shop-settings-editor';
import ManagedOrderCard,{type ManagedOrder} from './shop-managed-orders';
import './shop-manager.css';

type View={items:Product[];methods:ShopMethod[];categories:ShopCategory[];discounts:ShopDiscount[];orders:ManagedOrder[];page:number;pageSize:number;total:number};
const tabs=['Products','Categories','Delivery','Discounts','Orders'] as const;
type Tab=typeof tabs[number];
export default function ShopManager({onChange}:{onChange:()=>Promise<void>}) {
  const [view,setView]=useState<View|null>(null),[tab,setTab]=useState<Tab>('Products');
  const [editing,setEditing]=useState<{product:Product|null;id:string}|null>(null);
  const [filter,setFilter]=useState(''),[page,setPage]=useState(1),[loading,setLoading]=useState(true);
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[busy,setBusy]=useState(false);
  const locked=useRef(false),request=useRef(0);
  const refresh=useCallback(async()=>{
    const sequence=++request.current;
    setLoading(true);
    try {
      const r=await fetch('/api/shop/admin?'+new URLSearchParams({filter,page:String(page)}),{cache:'no-store'});
      if(!r.ok)throw Error('Could not load your shop.');
      const data:View=await r.json();
      if(request.current===sequence) {setView(data);setLoadError('');}
    } catch(e) {if(request.current===sequence)setLoadError((e as Error).message);}
    finally {if(request.current===sequence)setLoading(false);}
  },[filter,page]);
  useEffect(()=>{void refresh();return ()=>{request.current++;};},[refresh]);
  const save:SaveShop=async(action,form)=>{
    if(locked.current)return false;
    locked.current=true;setBusy(true);setMessage('');setError('');
    form.set('action',action);
    try {
      const response=await fetch('/api/shop/admin',{method:'POST',body:form});
      const data=await response.json() as {error?:string;message?:string};
      if(!response.ok) throw Error(data.error||'Could not save the changes.');
      setMessage(data.message|| (action==='dispatch'?'Fulfilment updated.':'Changes saved.'));
      await refresh();
      if(['dispatch','reconcile','refund','refundStatus'].includes(action))await onChange().catch(()=>{});
      return true;
    } catch(e) {
      setError((e as Error).message||'Could not save the changes.');
      await refresh();return false;
    } finally {locked.current=false;setBusy(false);}
  };
  function selectTab(next:Tab) {setTab(next);setEditing(null);setMessage('');setError('');}
  return <div className="shop-manager"><nav aria-label="Shop management" className="shop-admin-tabs">{tabs.map(item=><button key={item} type="button" aria-pressed={tab===item} disabled={busy} onClick={()=>selectTab(item)}>{item}</button>)}</nav>
    {loadError&&<p role="alert">{loadError} <button className="underlink" onClick={()=>void refresh()}>Try again</button></p>}
    {error&&<p role="alert" className="notice">{error}</p>}<p className="status-message" role="status">{busy?'Saving…':message}</p>
    {!view?(!loadError&&<p role="status">Loading shop…</p>):<>
    {tab==='Products'&&(editing?<ShopProductEditor key={editing.id} id={editing.id} product={editing.product} categories={view.categories} busy={busy} save={save} close={()=>setEditing(null)}/>:
      <section className="admin-section"><div className="shop-admin-title"><h2>Your products</h2><button className="button" disabled={busy} onClick={()=>setEditing({product:null,id:crypto.randomUUID()})}>Add product</button></div>
        {!view.items.length&&<p>Add your first kit or supply.</p>}
        {view.items.map(p=>{
          const variants=p.variants.filter(v=>v.active),untracked=variants.some(v=>v.stock===null),stock=variants.reduce((n,v)=>n+(v.stock||0),0);
          return <div className="row" key={p.id}><div><strong>{p.title}</strong><p>{gbp(p.price)} · {p.published?'Published':'Hidden'}{p.category&&' · '+p.category}</p>
            <p>{untracked?'Includes untracked stock':stock+' available'} · {variants.length} {variants.length===1?'variation':'variations'}</p></div>
            <button className="edit-link" disabled={busy} onClick={()=>setEditing({product:p,id:p.id})} aria-label={'Edit '+p.title}>Edit</button></div>;
        })}<div className="shop-admin-actions"><a className="underlink" href="/shop?preview=1">Preview shop and basket</a><a className="underlink" href="/shop">View public shop</a></div></section>)}
    {(tab==='Categories'||tab==='Delivery'||tab==='Discounts')&&<ShopSettings key={tab} group={tab==='Categories'?'category':tab==='Delivery'?'delivery':'discount'} categories={view.categories} methods={view.methods} discounts={view.discounts} busy={busy} save={save}/>}
    {tab==='Orders'&&<section className="admin-section"><div className="shop-admin-title"><h2>Shop orders</h2><label>Show orders <select value={filter} disabled={busy} onChange={e=>{setFilter(e.target.value);setPage(1);}}>
      <option value="">All orders</option><option value="waiting">Awaiting fulfilment</option><option value="dispatched">Dispatched or collected</option><option value="pending">Awaiting payment</option><option value="refunds">Refunds</option></select></label></div>
      {loading?<p role="status">Loading orders…</p>:<>{!view.orders.length&&<p>{filter?'No orders match this filter.':'Orders will appear here when a customer starts checkout.'}</p>}
      {view.orders.map(order=><ManagedOrderCard key={order.id} order={order} busy={busy} save={save}/>)}
      {view.total>view.pageSize&&<div className="shop-pagination"><button type="button" className="button outline" disabled={busy||view.page<=1} onClick={()=>setPage(view.page-1)}>Previous</button>
      <span>Page {view.page} of {Math.ceil(view.total/view.pageSize)}</span><button type="button" className="button outline" disabled={busy||view.page*view.pageSize>=view.total} onClick={()=>setPage(view.page+1)}>Next</button></div>}</>}
    </section>}</>}</div>;
}
