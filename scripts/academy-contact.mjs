import {createClient} from '@libsql/client';
import {createPublicKey} from 'node:crypto';
import {importKey} from './practice-import-key.mjs';

const recipient='ovbANjxVEbXogL32W9LGt4yp-zNVUUDPkAv_QLhO2Gk';
const secret=process.env.APP_ENCRYPTION_KEY;
if(process.env.VERCEL_ENV==='production' && secret && createPublicKey(importKey(secret)).export({format:'jwk'}).x===recipient) {
  const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
  const release='release:academy-whatsapp:2026-11-08';
  try {
    if(!(await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='courses'")).rows.length) await import('./migrate-vercel.mjs');
    await db.batch([
      {sql:"INSERT OR REPLACE INTO settings(id,value) SELECT 'academy_whatsapp',? WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id=?)",args:['447985566482',release]},
      {sql:'INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)',args:[release,'complete']},
    ],'write');
  } finally {db.close();}
}
