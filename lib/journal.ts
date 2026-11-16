import {db} from './server';

export type JournalPost = {id:string;title:string;body:string;published:boolean;version:number;date:string};

export async function journalPosts(includeDrafts=false):Promise<JournalPost[]> {
  const rows=await db().prepare("SELECT value FROM settings WHERE id GLOB 'journal:*'"+
    (includeDrafts?'':" AND json_extract(value,'$.published')=1")+
    " ORDER BY json_extract(value,'$.date') DESC,id DESC").all<{value:string}>();
  return rows.results.map(row=>JSON.parse(row.value) as JournalPost);
}

export async function saveJournalPost(input:unknown) {
  const data=input as Partial<JournalPost>|null;
  if(!data || typeof data.id!=='string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(data.id) ||
    typeof data.title!=='string' || !data.title.trim() || data.title.length>120 ||
    typeof data.body!=='string' || !data.body.trim() || data.body.length>10000 ||
    typeof data.published!=='boolean' || typeof data.version!=='number' || !Number.isSafeInteger(data.version) || data.version<0) return 'invalid';
  const database=db(),key='journal:'+data.id;
  const current=await database.prepare('SELECT value FROM settings WHERE id=?').bind(key).first<{value:string}>();
  const previous:JournalPost|null=current?JSON.parse(current.value):null;
  const title=data.title.trim(),body=data.body.trim();
  if(previous?.title===title && previous.body===body && previous.published===data.published)return 'saved';
  if((previous?.version??0)!==data.version)return 'conflict';
  const post:JournalPost={id:data.id,title,body,published:data.published,version:data.version+1,
    date:previous && (previous.published || !data.published)?previous.date:new Date().toISOString()};
  const value=JSON.stringify(post);
  const updated=current?await database.prepare('UPDATE settings SET value=? WHERE id=? AND value=?').bind(value,key,current.value).run():
    await database.prepare('INSERT OR IGNORE INTO settings (id,value) VALUES (?,?)').bind(key,value).run();
  return updated.meta.changes?'saved':'conflict';
}
