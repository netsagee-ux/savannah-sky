'use client';
import {useCallback,useEffect,useState} from 'react';
import type {JournalPost} from '@/lib/journal';

export default function JournalManager(){
  const [posts,setPosts]=useState<JournalPost[]>([]),[edit,setEdit]=useState<JournalPost|null>(null);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const load=useCallback(async()=>{
    try{
      const r=await fetch('/api/journal',{cache:'no-store'});
      if(!r.ok)throw Error();
      const result=await r.json() as {posts:JournalPost[]};
      setPosts(result.posts);
    }catch{setError('Posts could not be loaded. Refresh to try again.');}
  },[]);
  useEffect(()=>{void load();},[load]);
  function open(post:JournalPost){setNotice('');setError('');setEdit(post);}
  async function save(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!edit || busy)return;
    setError('');setBusy(true);
    try{
      const response=await fetch('/api/journal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(edit)});
      const result=await response.json() as {error?:string};
      if(!response.ok){if(response.status===409)await load();throw Error(result.error||'Could not save the post.');}
      setNotice(edit.published?'Post published.':'Draft saved.');setEdit(null);await load();
    }catch(e){setError(e instanceof Error?e.message:'Could not save the post.');}finally{setBusy(false);}
  }
  return <section className="admin-section"><a className="underlink" href="/journal">View public journal</a>
    {error&&<p role="alert">{error}</p>}<p role="status">{notice}</p>
    {edit?<form className="form" onSubmit={save}><fieldset disabled={busy} className="shop-fields">
      <label>Post title<input required maxLength={120} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label>
      <label>Post text<textarea required rows={7} maxLength={10000} value={edit.body} onChange={e=>setEdit({...edit,body:e.target.value})}/></label>
      <label>Visibility<select value={edit.published?'published':'draft'} onChange={e=>setEdit({...edit,published:e.target.value==='published'})}><option value="draft">Draft</option><option value="published">Public journal</option></select></label>
      <div className="shop-admin-actions"><button className="button" disabled={busy}>{edit.published?'Save and publish':'Save draft'}</button>
      <button className="button outline" type="button" onClick={()=>setEdit(null)}>Cancel</button></div>
    </fieldset></form>:<><button className="button" type="button" onClick={()=>open({id:crypto.randomUUID(),title:'',body:'',published:false,version:0,date:''})}>Add post</button>
      {posts.map(post=><div className="row" key={post.id}><div><strong>{post.title}</strong><p>{post.published?'Published':'Draft'}</p></div>
        <button className="edit-link" aria-label={'Edit '+post.title} onClick={()=>open(post)}>Edit</button></div>)}</>}
  </section>;
}
