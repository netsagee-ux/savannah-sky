'use client';
import {useState} from 'react';
import {gbp} from '@/lib/shop-types';
import type {SaveShop} from './shop-product-editor';
export type ShopCategory={id:string;name:string};
export type ShopMethod={id:string;name:string;kind:'delivery'|'collection';price:number;active:number};
export type ShopDiscount={code:string;kind:'percent'|'fixed';value:number;active:number};
type Group='category'|'delivery'|'discount';
type Entry={id?:string;name?:string;code?:string;kind?:string;price?:number;value?:number;active?:number};
export function ShopSettingForm({group,entry,busy,save,close}:{group:Group;entry:Entry|null;busy:boolean;save:SaveShop;close:()=>void}) {
  const [id]=useState(()=>entry?.id||crypto.randomUUID()),[kind,setKind]=useState(entry?.kind|| (group==='delivery'?'delivery':'percent'));
  const [remove,setRemove]=useState(false);
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();const form=new FormData(e.currentTarget);form.set('id',id);
    if(group==='discount'&&entry) form.set('editCode','1');
    if(await save(group,form)) close();
  }
  async function removeCategory() {const form=new FormData();form.set('id',id);if(await save('removeCategory',form)) close();}
  return <div className="shop-setting-editor"><form className="form" onSubmit={submit}><fieldset disabled={busy} className="shop-fields">
    {group==='discount'?<><label>Discount code<input name="code" required readOnly={!!entry} defaultValue={entry?.code} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_\-]*" autoCapitalize="characters"/></label>
      <label>Discount type<select name="kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="percent">Percentage</option><option value="fixed">Fixed amount</option></select></label>
      <label>{kind==='percent'?'Discount (%)':'Discount (£)'}<input key={kind} name="value" required type="number" min={kind==='percent'?1:.01} max={kind==='percent'?100:10000} step={kind==='percent'?1:.01} defaultValue={entry?.kind===kind?(kind==='percent'?entry.value:(entry.value||0)/100):''}/></label></>:
      <label>{group==='category'?'Category name':'Option name'}<input name="name" required maxLength={80} defaultValue={entry?.name} placeholder={group==='delivery'?'e.g. Standard UK delivery':undefined}/></label>}
    {group==='delivery'&&<><label>Fulfilment method<select name="kind" defaultValue={entry?.kind||'delivery'}><option value="delivery">UK delivery</option><option value="collection">Collection from the salon</option></select></label>
      <label>Charge per order (£)<input type="number" name="price" required min="0" max="10000" step="0.01" defaultValue={entry?Number(entry.price)/100:''}/></label></>}
    {group!=='category'&&<label>Status<select name="active" defaultValue={entry&&!entry.active?'0':'1'}><option value="1">Active</option><option value="0">Inactive</option></select></label>}
    <div className="shop-admin-actions"><button className="button">Save {group==='delivery'?'option':group==='discount'?'code':'category'}</button>
      <button className="button outline" type="button" onClick={close}>Cancel</button></div>
    </fieldset></form>
    {entry&&group==='category'&&<div className="shop-remove">{remove?<><p>Remove this category? Its products will appear as uncategorised.</p>
      <button type="button" className="underlink" disabled={busy} onClick={removeCategory}>Yes, remove category</button> <button type="button" className="underlink" disabled={busy} onClick={()=>setRemove(false)}>Keep category</button></>:
      <button type="button" className="underlink" disabled={busy} onClick={()=>setRemove(true)}>Remove category</button>}</div>}</div>;
}
export function ShopSettings({group,categories,methods,discounts,busy,save}:{group:Group;categories:ShopCategory[];methods:ShopMethod[];discounts:ShopDiscount[];busy:boolean;save:SaveShop}) {
  const [entry,setEntry]=useState<Entry|null|undefined>();
  const label=group==='category'?'category':group==='delivery'?'delivery option':'discount code';
  const list:Entry[]=group==='category'?categories:group==='delivery'?methods:discounts;
  return <section className="admin-section"><div className="shop-admin-title"><h2>{group==='category'?'Product categories':group==='delivery'?'Delivery and collection':'Discount codes'}</h2>
    {entry===undefined&&<button className="button" disabled={busy} onClick={()=>setEntry(null)}>Add {label}</button>}</div>
    {entry!==undefined&&<ShopSettingForm key={entry?.id||entry?.code||'new'} group={group} entry={entry} busy={busy} save={save} close={()=>setEntry(undefined)}/>}
    {!list.length&&entry===undefined&&<p>No {group==='category'?'categories':group==='delivery'?'delivery options':'discount codes'} yet.</p>}
    {list.map(item=><div className="row" key={item.id||item.code}><div><strong>{item.name||item.code}</strong>
      {group!=='category'&&<p>{group==='delivery'?[(item.kind==='collection'?'Salon collection':'UK delivery'),gbp(item.price||0)].join(' · '):item.kind==='percent'?item.value+'% off':gbp(item.value||0)+' off'} · {item.active?'Active':'Inactive'}</p>}</div>
      <button className="edit-link" disabled={busy} onClick={()=>setEntry(item)} aria-label={'Edit '+(item.name||item.code)}>Edit</button></div>)}
  </section>;
}
