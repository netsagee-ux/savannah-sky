import {createClient} from '@libsql/client';
import {readdir,readFile} from 'node:fs/promises';
if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)throw Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before migrating.');
const client=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
try{
 await client.execute('CREATE TABLE IF NOT EXISTS _academy_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
 const applied=new Set((await client.execute('SELECT name FROM _academy_migrations')).rows.map(r=>r.name));
 for(const name of (await readdir(new URL('../drizzle/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()){
  if(applied.has(name))continue;
  const sql=await readFile(new URL('../drizzle/'+name,import.meta.url),'utf8');
  const statements=sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
  await client.batch([...statements,{sql:'INSERT INTO _academy_migrations(name,applied_at) VALUES (?,?)',args:[name,new Date().toISOString()]}],'write');
  console.log('Applied '+name);
 }
}finally{client.close();}
