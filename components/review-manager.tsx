'use client';import {useEffect,useState} from 'react';
type Review={id:string;name:string;text:string;source:string;published:boolean};
export default function ReviewManager(){const [reviews,setReviews]=useState<Review[]>([]),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);const [loading,setLoading]=useState(true);
async function load(){
  setLoading(true);setStatus('');
  try{
    const response=await fetch('/api/reviews',{cache:'no-store',signal:AbortSignal.timeout?.(30000)});
    if(!response.ok)throw Error();
    const data=await response.json() as {reviews:Review[]};
    setReviews(data.reviews);setLoaded(true);
  }catch{setStatus('Unable to load reviews. Please try again.');}
  finally{setLoading(false);}
}
useEffect(()=>{void load();},[]);
function update(id:string,key:keyof Review,value:string|boolean){setReviews(rows=>rows.map(r=>r.id===id?{...r,[key]:value}:r))}return <section className="admin-section"><h2>Client reviews</h2><p>Add real feedback with the client’s permission. Published reviews appear in the Studio reviews section on the homepage.</p>{!loaded&&(loading?<p role="status">Loading reviews…</p>:<button type="button" className="underlink" onClick={load}>Try again</button>)}<form className="form" onSubmit={async e=>{e.preventDefault();setBusy(true);setStatus('');try{const r=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviews})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error);setStatus('Reviews saved.')}catch(e){setStatus((e as Error).message)}finally{setBusy(false)}}}>{reviews.map(r=><fieldset className="review-editor" key={r.id} disabled={busy}><legend>Client feedback</legend><label>Client name<input required maxLength={100} value={r.name} onChange={e=>update(r.id,'name',e.target.value)}/></label><label>Review<textarea required maxLength={1000} value={r.text} onChange={e=>update(r.id,'text',e.target.value)}/></label><label>Original review link (optional)<input type="url" value={r.source||''} onChange={e=>update(r.id,'source',e.target.value)}/></label><label>Visibility<select value={r.published?'published':'draft'} onChange={e=>update(r.id,'published',e.target.value==='published')}><option value="draft">Draft</option><option value="published">Published</option></select></label><button className="soft-link" type="button" onClick={()=>setReviews(rows=>rows.filter(x=>x.id!==r.id))}>Remove review</button></fieldset>)}<div className="calm-actions"><button className="button outline" type="button" disabled={!loaded||busy||reviews.length>=30} onClick={()=>setReviews(rows=>[...rows,{id:crypto.randomUUID(),name:'',text:'',source:'',published:false}])}>Add review</button><button className="button" aria-busy={busy} disabled={!loaded||busy}>{busy?'Saving…':'Save reviews'}</button></div><p role="status">{status}</p></form></section>}
