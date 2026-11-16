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
  `CREATE TABLE IF NOT EXISTS shop_categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE)`,
  `CREATE TABLE IF NOT EXISTS shop_product_categories (
    product_id TEXT PRIMARY KEY REFERENCES shop_products(id), category_id TEXT NOT NULL REFERENCES shop_categories(id))`,
  `CREATE TABLE IF NOT EXISTS shop_variants (
    id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES shop_products(id), colour TEXT NOT NULL COLLATE NOCASE DEFAULT '',
    size TEXT NOT NULL COLLATE NOCASE DEFAULT '', stock INTEGER CHECK(stock IS NULL OR (typeof(stock)='integer' AND stock>=0)),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS shop_variant_options ON shop_variants(product_id,colour,size) WHERE active=1`,
  `CREATE TABLE IF NOT EXISTS shop_delivery_methods (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('delivery','collection')),
    price INTEGER NOT NULL CHECK(price>=0), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)))`,
  `CREATE TABLE IF NOT EXISTS shop_discounts (
    code TEXT PRIMARY KEY COLLATE NOCASE, kind TEXT NOT NULL CHECK(kind IN ('fixed','percent')),
    value INTEGER NOT NULL CHECK(value>0 AND (kind!='percent' OR value<=100)), active INTEGER NOT NULL CHECK(active IN (0,1)))`,
  `CREATE TABLE IF NOT EXISTS shop_order_details (
    order_id TEXT PRIMARY KEY REFERENCES shop_orders(id), method_id TEXT NOT NULL, method_name TEXT NOT NULL,
    method_kind TEXT NOT NULL, discount_code TEXT, discount_amount INTEGER NOT NULL, subtotal INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS shop_order_reservations (
    order_id TEXT NOT NULL REFERENCES shop_orders(id), variant_id TEXT NOT NULL REFERENCES shop_variants(id),
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20), tracked INTEGER NOT NULL CHECK(tracked IN (0,1)),
    restored INTEGER NOT NULL DEFAULT 0 CHECK(restored IN (0,1)), PRIMARY KEY(order_id,variant_id))`,
  `CREATE INDEX IF NOT EXISTS shop_variant_reservations ON shop_order_reservations(variant_id,restored)`,
  `CREATE INDEX IF NOT EXISTS shop_orders_pending ON shop_orders(status,created_at)`,
  // Re-check the server quote in the same write transaction that reserves the order.
  `CREATE TRIGGER IF NOT EXISTS shop_verify_quote BEFORE INSERT ON shop_order_details BEGIN
     SELECT RAISE(ABORT,'shop quote changed') WHERE NOT EXISTS (
       SELECT 1 FROM shop_orders o JOIN shop_delivery_methods m ON m.id=NEW.method_id
       WHERE o.id=NEW.order_id AND m.active=1 AND m.price=o.shipping
       AND m.kind=NEW.method_kind AND m.name=NEW.method_name AND o.amount=NEW.subtotal+o.shipping-NEW.discount_amount);
     SELECT RAISE(ABORT,'shop discount changed') WHERE NEW.discount_code IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM shop_discounts d WHERE d.code=NEW.discount_code AND d.active=1
       AND NEW.discount_amount=CASE WHEN d.kind='percent' THEN (NEW.subtotal*d.value+50)/100 ELSE min(NEW.subtotal,d.value) END);
   END`,
  `CREATE TRIGGER IF NOT EXISTS shop_reserve_stock BEFORE INSERT ON shop_order_reservations BEGIN
     SELECT RAISE(ABORT,'shop item changed') WHERE NOT EXISTS (
       SELECT 1 FROM shop_variants v JOIN shop_products p ON p.id=v.product_id
       JOIN shop_orders o ON o.id=NEW.order_id JOIN json_each(o.items) l
       WHERE v.id=NEW.variant_id AND json_extract(l.value,'$.variantId')=v.id AND json_extract(l.value,'$.id')=p.id
       AND json_extract(l.value,'$.price')=p.price AND json_extract(l.value,'$.title')=p.title
       AND json_extract(l.value,'$.colour')=v.colour AND json_extract(l.value,'$.size')=v.size
       AND v.active=1 AND p.published=1 AND NEW.tracked=(v.stock IS NOT NULL)
       AND (v.stock IS NULL OR v.stock>=NEW.quantity));
     UPDATE shop_variants SET stock=stock-NEW.quantity WHERE id=NEW.variant_id AND NEW.tracked=1;
   END`,
  `CREATE TRIGGER IF NOT EXISTS shop_restore_units AFTER UPDATE OF restored ON shop_order_reservations
    WHEN NEW.restored=1 AND OLD.restored=0 AND OLD.tracked=1 BEGIN
      UPDATE shop_variants SET stock=stock+NEW.quantity WHERE id=NEW.variant_id;
    END`,
  `CREATE TRIGGER IF NOT EXISTS shop_release_failed_order AFTER UPDATE OF status ON shop_orders
    WHEN OLD.status='pending' AND NEW.status IN ('failed','expired','cancelled') BEGIN
      UPDATE shop_order_reservations SET restored=1 WHERE order_id=NEW.id AND restored=0;
    END`,
  // An old published product has no recorded count. Preserve that until staff enter its inventory.
  `INSERT INTO shop_variants(id,product_id) SELECT p.id,p.id FROM shop_products p
    WHERE NOT EXISTS(SELECT 1 FROM shop_variants v WHERE v.product_id=p.id)`,
  `INSERT OR IGNORE INTO shop_delivery_methods(id,name,kind,price,active)
    SELECT 'standard','Standard UK delivery','delivery',CAST(value AS INTEGER),1 FROM settings WHERE id='shop:postage'`,

];
let ready:Promise<unknown>|undefined;
export async function shopDatabase(){
  const database=db();
  ready??=database.batch(statements.map(sql=>database.prepare(sql))).catch(e=>{ready=undefined;throw e;});
  await ready;
  return database;
}
