'use client';
import {useState} from 'react';
import type {Product} from '@/lib/shop-types';
import {sampleVisibility} from '@/lib/shop-types';
export type SaveShop=(action:string,form:FormData)=>Promise<boolean>;
type Category={id:string;name:string};
type Draft={id:string;colour:string;size:string;stock:string;active:boolean;untracked:boolean};
export default function ShopProductEditor({product,id,categories,busy,save,close}:{product:Product|null;id:string;categories:Category[];busy:boolean;save:SaveShop;close:()=>void}) {
  const [rows,setRows]=useState<Draft[]>(()=>product?.variants.length?product.variants.map(v=>({id:v.id,colour:v.colour,size:v.size,stock:v.stock===null?'':String(v.stock),active:!!v.active,untracked:v.stock===null})):
    [{id,colour:'',size:'',stock:'0',active:true,untracked:false}]);
  function update(id:string,values:Partial<Draft>) {setRows(prev=>prev.map(row=>row.id===id?{...row,...values}:row));}
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    form.set('id',id);form.set('originalVersion',product?.updated_at||'');
    form.set('originalStock',JSON.stringify(product?.variants.map(v=>({id:v.id,stock:v.stock}))||[]));
    form.set('variants',JSON.stringify(rows.map(v=>({id:v.id,colour:v.colour,size:v.size,stock:v.stock===''?null:Number(v.stock),active:Number(v.active)}))));
    if(await save('product',form)) close();
  }
  return <section className="admin-section"><h2>{product?'Edit product':'Add a product'}</h2>
    <form onSubmit={submit} className="form"><fieldset disabled={busy} className="shop-fields">
      <label>Product name<input name="title" required defaultValue={product?.title} maxLength={120}/></label>
      <label>Description<textarea name="description" rows={3} required defaultValue={product?.description} maxLength={1500}/></label>
      <label>Price (£)<input name="price" type="number" min="0.50" max="10000" step="0.01" required defaultValue={product?product.price/100:''}/></label>
      <label>Category<select name="category" defaultValue={product?.category_id||''}><option value="">Uncategorised</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Product photo (up to 2 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label>
      <label>Shop visibility<select name="published" defaultValue={product?.published??0}><option value="0">Hidden from shop</option><option value={sampleVisibility}>Public sample · demo checkout</option><option value="1">Show in shop · available to order</option></select></label>
      <div><h3>Stock and variations</h3><p>For a single product, leave colour and size blank. Enter the quantity available to sell for each variation.</p></div>
      {rows.map((v,i)=><fieldset key={v.id} className="shop-variant"><legend>Variation {i+1}</legend>
        <label>Colour<input value={v.colour} maxLength={80} onChange={e=>update(v.id,{colour:e.target.value})}/></label>
        <label>Size<input value={v.size} maxLength={80} onChange={e=>update(v.id,{size:e.target.value})}/></label>
        <label>Available stock<input type="number" min="0" max="1000000" step="1" required={!v.untracked} placeholder={v.untracked?'Currently untracked':undefined} value={v.stock} onChange={e=>update(v.id,{stock:e.target.value})}/></label>
        <label>Variation visibility<select value={v.active?'1':'0'} onChange={e=>update(v.id,{active:e.target.value==='1'})}><option value="1">Show in shop</option><option value="0">Hide variation</option></select></label>
        {rows.length>1&&!product?.variants.some(option=>option.id===v.id)&&<button className="underlink" type="button" onClick={()=>setRows(prev=>prev.filter(row=>row.id!==v.id))}>Remove this row</button>}
      </fieldset>)}
      <button className="button outline" type="button" disabled={rows.length>=100} onClick={()=>setRows(prev=>[...prev,{id:crypto.randomUUID(),colour:'',size:'',stock:'0',active:true,untracked:false}])}>Add another variation</button>
      <div className="shop-admin-actions"><button className="button" disabled={busy}>Save product</button><button type="button" className="button outline" onClick={close}>Cancel</button></div>
    </fieldset></form></section>;
}
