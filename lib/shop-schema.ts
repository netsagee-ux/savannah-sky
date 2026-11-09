import {db} from './server';
const statements=[
  `CREATE TABLE IF NOT EXISTS shop_products (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>=50),
    published INTEGER NOT NULL DEFAULT 0, photo BLOB, mime TEXT, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS shop_orders (
    id TEXT PRIMARY KEY,user_id TEXT NOT NULL,email TEXT NOT NULL,items TEXT NOT NULL,shipping INTEGER NOT NULL,
    amount INTEGER NOT NULL,delivery TEXT NOT NULL,fingerprint TEXT NOT NULL,merchant TEXT NOT NULL,
    session_id TEXT UNIQUE,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,paid_at TEXT,
    dispatched_at TEXT,tracking TEXT)`,
  'CREATE INDEX IF NOT EXISTS shop_orders_buyer ON shop_orders(user_id,created_at)',
];
let ready:Promise<unknown>|undefined;
export async function shopDatabase(){
  const database=db();
  ready??=database.batch(statements.map(sql=>database.prepare(sql))).catch(e=>{ready=undefined;throw e;});
  await ready;
  return database;
}
