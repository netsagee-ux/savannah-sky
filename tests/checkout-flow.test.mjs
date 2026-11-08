import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

function moduleUrl(source) {
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}

async function compile(path, imports) {
  let source = await readFile(path, 'utf8');
  for (const [from, to] of Object.entries(imports)) source = source.replaceAll("'" + from + "'", JSON.stringify(to));
  return moduleUrl(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}

test('course checkout checks availability, charges the listed price and grants access only after verified payment', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'academy-checkout-'));
  const fixture = {
    APP_ENCRYPTION_KEY: 'playback-fixture', TURSO_DATABASE_URL: 'file:' + join(dir, 'orders.db'), TURSO_AUTH_TOKEN: 'fixture',
    STRIPE_SECRET_KEY: 'sk_live_fixture_only', STRIPE_WEBHOOK_SECRET: 'fixture', PUBLIC_PAYMENTS_READY: 'true',
  };
  const previous = Object.fromEntries(Object.keys(fixture).map(key => [key, process.env[key]]));
  Object.assign(process.env, fixture);
  t.after(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    delete globalThis.academyCheckoutIdentity;
    await rm(dir, { recursive: true, force: true });
  });

  const adapter = await compile('lib/vercel-database.ts', { '@libsql/client': import.meta.resolve('@libsql/client') });
  const db = (await import(adapter)).database();
  const server = moduleUrl(`export { database as db } from ${JSON.stringify(adapter)};
    export const bucket = () => ({head: async key => key === 'private-video-key' ? {size:512} : null});
    export const admin = async () => false;
    export const enrolled = async () => globalThis.academyCheckoutIdentity.enrolled;`);
  const identity = moduleUrl('export const getChatGPTUser = async () => globalThis.academyCheckoutIdentity.user;');
  const security = await compile('lib/payment-security.ts', {});
  const payments = await compile('lib/payments.ts', { './server': server, './payment-security': security });
  const orderModule = await compile('lib/course-orders.ts', { './server': server });
  const { confirmManualPayment, ownedOrder } = await import(orderModule);
  const { fulfill } = await import(payments);
  const { POST } = await import(await compile('app/api/checkout/route.ts', {
    '@/app/chatgpt-auth': identity, '@/lib/server': server, '@/lib/payments': payments, '@/lib/course-orders': orderModule,
  }));
  for (const sql of [
    'CREATE TABLE settings(id TEXT PRIMARY KEY,value TEXT)',
    'CREATE TABLE courses(id TEXT PRIMARY KEY, title TEXT, price INTEGER, course_url TEXT, published INTEGER)',
    'CREATE TABLE lessons(id TEXT, course_id TEXT, video_key TEXT, video_url TEXT, position INTEGER)',
    'CREATE TABLE enrollments(id TEXT PRIMARY KEY, email TEXT, course_id TEXT)',
    'CREATE TABLE orders(id TEXT PRIMARY KEY,user_id TEXT,email TEXT,course_id TEXT,title TEXT,amount INTEGER,currency TEXT,status TEXT,mode TEXT,created_at TEXT,session_id TEXT,paid_at TEXT)',
    "INSERT INTO courses VALUES('gel','Gel Foundations',6500,NULL,0)",
  ]) await db.prepare(sql).run();

  globalThis.academyCheckoutIdentity = { user: null, enrolled: false };
  let stripeForm;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    stripeForm = options.body;
    return Response.json({ id: 'cs_fixture', url: 'https://checkout.stripe.com/c/pay/fixture' });
  });
  const checkout = (options = {}) => POST(new Request('https://academy.example/api/checkout', {
    method: 'POST', headers: { origin: 'https://academy.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId: 'gel', price: 1, ...options }),
  }));

  assert.equal((await checkout()).status, 401);
  globalThis.academyCheckoutIdentity.user = { userId: 'student', email: 'Student@example.com' };
  assert.equal((await checkout()).status, 409);
  await db.prepare("UPDATE courses SET published=1 WHERE id='gel'").run();
  assert.equal((await checkout()).status, 409);
  await db.prepare("INSERT INTO lessons VALUES('prep','gel','private-video-key',NULL,1)").run();
  process.env.PUBLIC_PAYMENTS_READY = 'false';
  assert.equal((await checkout()).status, 503);
  process.env.PUBLIC_PAYMENTS_READY = 'true';
  assert.equal(stripeForm, undefined);
  const response = await checkout();
  assert.equal(response.status, 200);
  assert.match((await response.json()).url, /^https:\/\/checkout\.stripe\.com\//);
  assert.equal(stripeForm.get('line_items[0][price_data][unit_amount]'), '6500');
  assert.equal(stripeForm.get('cancel_url'), 'https://academy.example/courses/gel#enrol');

  const order = await db.prepare('SELECT * FROM orders').first();
  const session = { id: order.session_id, status: 'complete', payment_status: 'paid', amount_total: 6500,
    currency: 'gbp', metadata: { orderId: order.id, courseId: 'gel' }, customer_email: 'student@example.com', livemode: true };
  assert.equal(await fulfill({ ...session, amount_total: 1 }), false);
  assert.equal((await db.prepare('SELECT * FROM enrollments').all()).results.length, 0);
  assert.equal(await fulfill(session), true);
  assert.equal(await fulfill(session), true);
  assert.equal((await db.prepare('SELECT * FROM enrollments').all()).results.length, 1);
  globalThis.academyCheckoutIdentity.enrolled = true;
  assert.equal((await (await checkout()).json()).enrolled, true);

  globalThis.academyCheckoutIdentity = { user: {userId:'manual-student',email:'manual@example.com'}, enrolled:false };
  process.env.PUBLIC_PAYMENTS_READY = 'false';
  assert.equal((await checkout({handoff:true})).status,503);
  await db.prepare("INSERT INTO settings VALUES('academy_whatsapp','+44 7700 900123')").run();
  const manual = await (await checkout({handoff:true})).json();
  assert.equal(new URL(manual.url).pathname, '/447700900123');
  const message = new URL(manual.url).searchParams.get('text');
  assert.ok(message.includes('Gel Foundations (£65.00)'));
  assert.ok(message.includes('https://academy.example/orders/'+manual.orderId));
  assert.ok(!message.includes('manual@example.com'));
  assert.equal((await (await checkout({handoff:true})).json()).orderId,manual.orderId);
  assert.ok(!await ownedOrder(manual.orderId,'stranger'));
  assert.equal((await ownedOrder(manual.orderId,'manual-student')).status,'pending');
  assert.equal((await db.prepare("SELECT id FROM enrollments WHERE email='manual@example.com'").all()).results.length,0);
  await confirmManualPayment(manual.orderId);
  await confirmManualPayment(manual.orderId);
  assert.equal((await ownedOrder(manual.orderId,'manual-student')).status,'paid');
  assert.equal((await db.prepare("SELECT id FROM enrollments WHERE email='manual@example.com'").all()).results.length,1);

  process.env.PUBLIC_PAYMENTS_READY = 'true';
  globalThis.academyCheckoutIdentity.user = {userId:'online-student',email:'online@example.com'};
  const online = await (await checkout({handoff:true})).json();
  assert.equal((await ownedOrder(online.orderId,'online-student')).mode,'live');
  await assert.rejects(() => confirmManualPayment(online.orderId));
  globalThis.academyCheckoutIdentity.user = {userId:'stranger',email:'other@example.com'};
  assert.equal((await checkout({orderId:online.orderId})).status,409);
  globalThis.academyCheckoutIdentity.user = {userId:'online-student',email:'online@example.com'};
  assert.equal((await checkout({orderId:online.orderId})).status,200);
  assert.equal(stripeForm.get('metadata[orderId]'), online.orderId);
  assert.equal(stripeForm.get('cancel_url'),'https://academy.example/orders/'+online.orderId);

});

test('a paid enrolment follows the buyer’s account and rejects another account with the former email', async () => {
  const {DatabaseSync}=await import('node:sqlite');
  const db=new DatabaseSync(':memory:');
  db.exec("CREATE TABLE orders(email TEXT, course_id TEXT, user_id TEXT, status TEXT, mode TEXT); CREATE TABLE enrollments(id TEXT, email TEXT, course_id TEXT); INSERT INTO enrollments VALUES('access','original@example.test','gel');");
  const adapter=moduleUrl('export const database = () => ({prepare: sql => ({ bind: (...args) => ({first: () => globalThis.enrolmentDb.prepare(sql).get(...args)}) })});');
  const identity=moduleUrl('export const getChatGPTUser=async()=>globalThis.enrolmentUser');
  globalThis.enrolmentDb=db;
  try {
    const {enrolled}=await import(await compile('lib/server.ts',{'./vercel-database':adapter,'./vercel-storage':moduleUrl('export const objectStorage = () => ({})'),'@/app/chatgpt-auth':identity}));
    globalThis.enrolmentUser={userId:'original',email:'original@example.test'};
    assert.equal(await enrolled('gel'),true);
    db.exec("INSERT INTO orders VALUES('original@example.test','gel','original','paid','whatsapp')");
    globalThis.enrolmentUser={userId:'new-account',email:'original@example.test'};
    assert.equal(await enrolled('gel'),false);
    globalThis.enrolmentUser={userId:'original',email:'updated@example.test'};
    assert.equal(await enrolled('gel'),true);
    db.exec('DELETE FROM enrollments');
    assert.equal(await enrolled('gel'),false);
  } finally {db.close();delete globalThis.enrolmentDb;delete globalThis.enrolmentUser;}
});
