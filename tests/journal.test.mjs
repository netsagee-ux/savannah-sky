import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('academy journal saves drafts, publishes, edits and withdraws a post',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'academy-journal-'));
  const env={TURSO_DATABASE_URL:'file:'+join(dir,'db.sqlite'),TURSO_AUTH_TOKEN:'fixture'};
  const before=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);
  t.after(async()=>{for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
    delete globalThis.journalStaff;await rm(dir,{recursive:true,force:true});});
  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const server=moduleUrl('export {database as db} from '+JSON.stringify(adapter)+';export const admin=async()=>Boolean(globalThis.journalStaff);');
  const db=(await import(adapter)).database();await db.prepare('CREATE TABLE settings(id TEXT PRIMARY KEY,value TEXT NOT NULL)').run();
  await db.prepare("INSERT INTO settings VALUES('unrelated','ordinary text')").run();
  const lib=await compile('lib/journal.ts',{'./server':server}),{journalPosts}=await import(lib);
  const api=await import(await compile('app/api/journal/route.ts',{'@/lib/journal':lib,'@/lib/server':server,'@/lib/request-origin':await compile('lib/request-origin.ts',{})}));
  const input={id:crypto.randomUUID(),title:'Swatch notes',body:'Number each stick.',published:false,version:0};
  const write=(data,origin='https://academy.test')=>api.POST(new Request('https://academy.test/api/journal',{method:'POST',headers:{origin},body:JSON.stringify(data)}));
  assert.equal((await api.GET()).status,403);assert.equal((await write(input)).status,403);
  globalThis.journalStaff=true;
  assert.equal((await write(input,'https://other.example')).status,403);
  assert.equal((await write({...input,title:''})).status,400);
  assert.equal((await write(input)).status,200);assert.deepEqual(await journalPosts(),[]);
  assert.equal((await write(input)).status,200);
  assert.equal((await write({...input,published:true})).status,409);
  assert.equal((await write({...input,published:true,version:1})).status,200);
  assert.equal((await journalPosts())[0].title,'Swatch notes');
  assert.equal((await write({...input,title:'Updated notes',published:true,version:2})).status,200);
  assert.equal((await write({...input,version:3})).status,200);assert.deepEqual(await journalPosts(),[]);
});
