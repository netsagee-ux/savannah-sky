import {shopDatabase} from './shop-schema';
import {shopId} from './shop';
import {SumUpError} from './sumup';
import {imageContentType} from './video-security';

const field=(form:FormData,key:string)=>String(form.get(key)??'').trim();
function pence(value:string,minimum:number) {
  if(!/^\d{1,5}(\.\d{1,2})?$/.test(value)) throw new SumUpError('Enter a GBP amount with up to two decimal places.',400);
  const amount=Math.round(Number(value)*100);
  if(amount<minimum || amount>1000000) throw new SumUpError('Check the amount entered.',400);
  return amount;
}
function textValue(form:FormData,key:string,label:string,length:number) {
  const value=field(form,key);
  if(!value || value.length>length) throw new SumUpError('Enter a valid '+label+'.',400);
  return value;
}
function identifier(form:FormData,allowStandard=false) {
  const id=field(form,'id');
  if(!shopId.test(id) && !(allowStandard && id==='standard')) throw new SumUpError('Refresh this item and try again.',400);
  return id;
}
type StockRow={id:string;colour:string;size:string;stock:number|null;active:number};
function variantRows(form:FormData,id:string):StockRow[] {
  let data:unknown;
  try {data=JSON.parse(field(form,'variants'));} catch {throw new SumUpError('Check the product variations.',400);}
  if(!Array.isArray(data) || !data.length || data.length>100) throw new SumUpError('Enter between one and 100 variations.',400);
  const names=new Set<string>(),ids=new Set<string>();
  const rows:StockRow[]=data.map(row=>{
    if(!row || !shopId.test(row.id) || ids.has(row.id) || typeof row.colour!=='string' || typeof row.size!=='string' ||
      ![0,1].includes(row.active) || (row.stock!==null && (!Number.isSafeInteger(row.stock) || row.stock<0 || row.stock>1000000)))
      throw new SumUpError('Check each variation and enter a whole available stock quantity.',400);
    const colour=row.colour.trim(),size=row.size.trim(),pair=JSON.stringify([colour.toLowerCase(),size.toLowerCase()]);
    if(colour.length>80 || size.length>80 || (row.active && names.has(pair))) throw new SumUpError('Each colour and size combination must be unique.',400);
    ids.add(row.id);if(row.active) names.add(pair);
    return {id:row.id,colour,size,stock:row.stock,active:row.active};
  });
  if(!rows.some(row=>row.active)) throw new SumUpError('Keep at least one variation available, or hide the whole product.',400);
  if(rows.filter(row=>row.active).length>1 && rows.some(row=>row.active&&!row.colour&&!row.size))
    throw new SumUpError('Give each available variation a colour or size.',400);
  if(rows.some(row=>!row.colour&&!row.size&&row.id!==id)) throw new SumUpError('Use the original row for a product without variations.',400);
  return rows;
}
export async function saveProduct(form:FormData) {
  const id=identifier(form),d=await shopDatabase();
  const title=textValue(form,'title','product name',120),description=textValue(form,'description','description',1500);
  const price=pence(field(form,'price'),50),published=field(form,'published')==='1'?1:0;
  let bytes:Uint8Array|null=null,mime:string|null=null;
  const file=form.get('photo');
  if(file instanceof File && file.size) {
    if(file.size>2*1024*1024) throw new SumUpError('Choose a photo under 2 MB.',400);
    bytes=new Uint8Array(await file.arrayBuffer());mime=imageContentType(bytes);
    if(!mime) throw new SumUpError('Use a JPG, PNG or WebP photo.',400);
  }
  const existing=await d.prepare('SELECT updated_at FROM shop_products WHERE id=?').bind(id).first<{updated_at:string}>();
  const version=field(form,'originalVersion');
  const changes=[];
  // Guard in the same write transaction as the update so a checkout cannot lose its stock change.
  const guard=(condition:string,...args:unknown[])=>d.prepare("SELECT CASE WHEN ("+condition+") THEN 1 ELSE json('Shop edit conflict') END").bind(...args);
  if(form.has('originalVersion')) {
    changes.push(version?guard('EXISTS(SELECT 1 FROM shop_products WHERE id=? AND updated_at=?)',id,version):
      guard('NOT EXISTS(SELECT 1 FROM shop_products WHERE id=?)',id));
  }
  const updatedAt=new Date(Math.max(Date.now(),Date.parse(existing?.updated_at||'')+1||0)).toISOString();
  changes.push(d.prepare(`INSERT INTO shop_products(id,title,description,price,published,photo,mime,updated_at) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,price=excluded.price,published=excluded.published,
    photo=coalesce(excluded.photo,shop_products.photo),mime=coalesce(excluded.mime,shop_products.mime),updated_at=excluded.updated_at`)
    .bind(id,title,description,price,published,bytes,mime,updatedAt));
  if(form.has('category')) {
    const category=field(form,'category');
    if(category&&!shopId.test(category)) throw new SumUpError('Select a current category.',400);
    if(category) {
      changes.push(guard('EXISTS(SELECT 1 FROM shop_categories WHERE id=?)',category));
      changes.push(d.prepare('INSERT INTO shop_product_categories(product_id,category_id) VALUES(?,?) ON CONFLICT(product_id) DO UPDATE SET category_id=excluded.category_id').bind(id,category));
    } else changes.push(d.prepare('DELETE FROM shop_product_categories WHERE product_id=?').bind(id));
  }
  if(form.has('variants')) {
    if(!form.has('originalVersion')) throw new SumUpError('Reopen the editor before changing stock.',409);
    const rows=variantRows(form,id);
    let snapshots:unknown;
    try {snapshots=JSON.parse(field(form,'originalStock'));} catch {throw new SumUpError('Reopen the product before changing stock.',409);}
    if(!Array.isArray(snapshots)||snapshots.length>100||snapshots.some(row=>!row||!shopId.test(row.id)||(row.stock!==null&&!Number.isSafeInteger(row.stock)))) throw new SumUpError('Reopen the product before changing stock.',409);
    const prior=new Map(snapshots.map(row=>[row.id,row]));
    if(prior.size!==snapshots.length || snapshots.some(row=>!rows.some(next=>next.id===row.id)))
      throw new SumUpError('Hide existing variations using their availability setting.',400);
    if(existing) {
      changes.push(guard('(SELECT count(*) FROM shop_variants WHERE product_id=?)=?',id,snapshots.length));
      changes.push(guard(`NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM shop_variants v
        WHERE v.product_id=? AND v.id=json_extract(j.value,'$.id') AND v.stock IS json_extract(j.value,'$.stock')))`,JSON.stringify(snapshots),id));
      // Release the active-option uniqueness constraint before swapping colour/size labels.
      changes.push(d.prepare('UPDATE shop_variants SET active=0 WHERE product_id=?').bind(id));
    }
    for(const row of rows) {
      if(row.stock===null && (!prior.has(row.id)||prior.get(row.id).stock!==null)) throw new SumUpError('Enter an available stock quantity for the new variation.',400);
      if(prior.has(row.id)) changes.push(d.prepare('UPDATE shop_variants SET colour=?,size=?,stock=?,active=? WHERE id=? AND product_id=?').bind(row.colour,row.size,row.stock,row.active,row.id,id));
      else changes.push(d.prepare('INSERT INTO shop_variants(id,product_id,colour,size,stock,active) VALUES(?,?,?,?,?,?)').bind(row.id,id,row.colour,row.size,row.stock,row.active));
    }
  } else if(!existing) {
    // The previous product form did not collect stock. Keep that form usable without inventing inventory.
    changes.push(d.prepare("INSERT OR IGNORE INTO shop_variants(id,product_id,colour,size,stock,active) VALUES(?,?,'','',NULL,1)").bind(id,id));
  }
  try { await d.batch(changes); }
  catch(e) {
    if(/malformed JSON/i.test(String(e))) throw new SumUpError('The product or its stock has changed. Reopen it to edit the latest quantities.',409);
    if(/unique constraint/i.test(String(e))) throw new SumUpError('That variation already exists. Check the colour and size combinations.',409);
    throw e;
  }
}
export async function manageShopSetting(form:FormData,action:string) {
  const d=await shopDatabase(),active=field(form,'active')==='1'?1:0;
  if(action==='category') {
    const id=identifier(form),name=textValue(form,'name','category name',80);
    await d.prepare('INSERT INTO shop_categories(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(id,name).run();
  } else if(action==='removeCategory') {
    const id=identifier(form);
    await d.batch([d.prepare('DELETE FROM shop_product_categories WHERE category_id=?').bind(id),d.prepare('DELETE FROM shop_categories WHERE id=?').bind(id)]);
  } else if(action==='delivery') {
    const id=identifier(form,true),name=textValue(form,'name','delivery option name',80),kind=field(form,'kind'),price=pence(field(form,'price'),0);
    if(!['delivery','collection'].includes(kind)) throw new SumUpError('Select delivery or collection.',400);
    await d.prepare(`INSERT INTO shop_delivery_methods(id,name,kind,price,active) VALUES(?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,price=excluded.price,active=excluded.active`).bind(id,name,kind,price,active).run();
  } else if(action==='postage') {
    const amount=pence(field(form,'postage'),0);
    await d.batch([
      d.prepare("INSERT INTO settings(id,value) VALUES('shop:postage',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(String(amount)),
      d.prepare("INSERT INTO shop_delivery_methods(id,name,kind,price,active) VALUES('standard','Standard UK delivery','delivery',?,1) ON CONFLICT(id) DO UPDATE SET price=excluded.price,active=1").bind(amount),
    ]);
  } else if(action==='discount') {
    const code=field(form,'code').toUpperCase(),kind=field(form,'kind'),raw=field(form,'value');
    if(!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(code)||!['percent','fixed'].includes(kind)) throw new SumUpError('Use a code of up to 32 letters, numbers, dashes or underscores.',400);
    const value=kind==='fixed'?pence(raw,1):Number(raw);
    if(kind==='percent'&&(!/^\d+$/.test(raw)||value<1||value>100)) throw new SumUpError('Enter a whole percentage from 1 to 100.',400);
    if(!form.get('editCode')) {
      await d.prepare('INSERT INTO shop_discounts(code,kind,value,active) VALUES(?,?,?,?)').bind(code,kind,value,active).run();
    } else {
      const result=await d.prepare('UPDATE shop_discounts SET kind=?,value=?,active=? WHERE code=?').bind(kind,value,active,code).run();
      if(!result.meta.changes) throw new SumUpError('The discount no longer exists.',409);
    }
  } else throw new SumUpError('Unknown shop setting.',400);
}
