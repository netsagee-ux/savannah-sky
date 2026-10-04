import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {head} from '@vercel/blob';

// Runs only when explicitly invoked against a configured private store.
// Creates one disposable verification object and removes it in finally.
const source=(await readFile(new URL('../lib/vercel-storage.ts',import.meta.url),'utf8'))
 .replace("'@aws-sdk/client-s3'",JSON.stringify(import.meta.resolve('@aws-sdk/client-s3')))
 .replace("'@vercel/blob'",JSON.stringify(import.meta.resolve('@vercel/blob')));
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {objectStorage}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const storage=objectStorage();
const key='verification/'+crypto.randomUUID()+'.txt';
const bytes=new TextEncoder().encode('Savannah Sky private storage verification.');
try{
 await storage.put(key,bytes.buffer,{httpMetadata:{contentType:'text/plain'}});
 assert.equal((await storage.head(key)).size,bytes.length);
 const full=await storage.get(key);
 assert.equal(await new Response(full.body).text(),new TextDecoder().decode(bytes));
 const partial=await storage.get(key,{range:{offset:2,length:8}});
 assert.equal(partial.size,bytes.length);
 assert.equal(await new Response(partial.body).text(),new TextDecoder().decode(bytes.slice(2,10)));
 const metadata=await head(key);
 const unauthenticated=await fetch(metadata.url);
 assert.ok([401,403,404].includes(unauthenticated.status),'Private file must reject unauthenticated access');
 await unauthenticated.body?.cancel();
 console.log('PASS: upload, metadata, download, byte-range playback, and private access.');
}finally{
 await storage.delete(key);
}
assert.equal(await storage.head(key),null);
console.log('PASS: verification object removed.');
