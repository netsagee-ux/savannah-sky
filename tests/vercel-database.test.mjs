import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ts from 'typescript';
test('Vercel database adapter persists data and rolls back an entire failed payment batch',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'academy-db-'));
 const oldUrl=process.env.TURSO_DATABASE_URL,oldToken=process.env.TURSO_AUTH_TOKEN;
 process.env.TURSO_DATABASE_URL='file:'+join(dir,'test.db');process.env.TURSO_AUTH_TOKEN='test-only';
 try{
  const source=(await readFile('lib/vercel-database.ts','utf8')).replace("'@libsql/client'",JSON.stringify(import.meta.resolve('@libsql/client')));
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const {database}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const db=database();
  await db.prepare('CREATE TABLE purchases(id TEXT PRIMARY KEY,paid INTEGER NOT NULL)').run();
  await db.prepare('INSERT INTO purchases VALUES (?,?)').bind('buyer',0).run();
  await assert.rejects(db.batch([db.prepare('UPDATE purchases SET paid=1 WHERE id=?').bind('buyer'),db.prepare('INSERT INTO purchases VALUES (?,?)').bind('buyer',1)]));
  assert.equal((await db.prepare('SELECT paid FROM purchases WHERE id=?').bind('buyer').first()).paid,0);
  await db.batch([db.prepare('UPDATE purchases SET paid=1 WHERE id=?').bind('buyer')]);
  assert.equal((await db.prepare('SELECT paid FROM purchases').all()).results[0].paid,1);
 }finally{
  if(oldUrl===undefined)delete process.env.TURSO_DATABASE_URL;else process.env.TURSO_DATABASE_URL=oldUrl;
  if(oldToken===undefined)delete process.env.TURSO_AUTH_TOKEN;else process.env.TURSO_AUTH_TOKEN=oldToken;
  await rm(dir,{recursive:true,force:true});
 }
});
