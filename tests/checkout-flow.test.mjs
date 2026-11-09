import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('course checkout checks availability, charges the listed price and grants access only after verified payment', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'academy-checkout-'));
  const fixture = {
    APP_ENCRYPTION_KEY: 'playback-fixture', TURSO_DATABASE_URL: 'file:' + join(dir, 'orders.db'), TURSO_AUTH_TOKEN: 'fixture',
    RESEND_API_KEY: '', ACADEMY_RECEIPT_FROM: '', ACADEMY_PUBLIC_URL: 'https://academy.example',
    ADMIN_EMAIL: 'owner@example.test', ACADEMY_WHATSAPP_NUMBER: '',
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
  const identity = moduleUrl(`export const getChatGPTUser = async () => globalThis.academyCheckoutIdentity.user;
    export const chatGPTSignInPath = path => '/sign-in?redirect_url='+encodeURIComponent(path);`);
  const storage = moduleUrl(`export const objectStorage = () => ({
    head: async key => key === 'private-video-key' ? {size: 512} : null,
    get: async (_, options) => ({size: 512, body: new Uint8Array(options?.range?.length || 512),
      writeHttpMetadata: headers => headers.set('Content-Type', 'video/mp4')})
  });`);
  const server = await compile('lib/server.ts', {
    './vercel-database': adapter, './vercel-storage': storage, '@/app/chatgpt-auth': identity,
  });
  const security = await compile('lib/payment-security.ts', {});
  const privateUrls = await compile('lib/student-course-link.ts', {});
  const invite = await compile('lib/course-invitation.ts', {'./server':server,'./student-course-link':privateUrls});
  const receipts = await compile('lib/order-receipt.ts', { './server': server, './course-invitation': invite });
  const orderModule = await compile('lib/course-orders.ts', { './server': server, './order-receipt': receipts });
  const payments = await compile('lib/payments.ts', { './server': server, './payment-security': security, './course-orders': orderModule });
  const { confirmManualPayment, ownedOrder } = await import(orderModule);
  const { fulfill } = await import(payments);
  const { sendOrderReceipt } = await import(receipts);
  const sumup=await compile('lib/sumup.ts',{'./server':server,'./course-orders':orderModule,'./course-invitation':invite});
  const { POST } = await import(await compile('app/api/checkout/route.ts', {'@/lib/data':await compile('lib/data.ts',{}),'@/lib/qualifications':await compile('lib/qualifications.ts',{'./server':server}),
    '@/app/chatgpt-auth': identity, '@/lib/server': server, '@/lib/payments': payments, '@/lib/sumup':sumup,
  }));
  for (const sql of [
    'CREATE TABLE settings(id TEXT PRIMARY KEY,value TEXT)',
    'CREATE TABLE progress(id TEXT PRIMARY KEY,user_id TEXT,lesson_id TEXT,completed_at TEXT)',
    'CREATE TABLE courses(id TEXT PRIMARY KEY, title TEXT, price INTEGER, course_url TEXT, published INTEGER, level TEXT)',
    'CREATE TABLE lessons(id TEXT, course_id TEXT, video_key TEXT, video_url TEXT, position INTEGER,question TEXT,answer INTEGER,options TEXT)',
    'CREATE TABLE enrollments(id TEXT PRIMARY KEY, email TEXT, course_id TEXT)',
    'CREATE TABLE orders(id TEXT PRIMARY KEY,user_id TEXT,email TEXT,course_id TEXT,title TEXT,amount INTEGER,currency TEXT,status TEXT,mode TEXT,created_at TEXT,session_id TEXT,paid_at TEXT)',
    "INSERT INTO courses VALUES('gel','Gel Foundations',6500,NULL,0,'Beginner')",
  ]) await db.prepare(sql).run();

  globalThis.academyCheckoutIdentity = { user: null };
  let stripeForm;
  const emailRequests = [];
  let mailAvailable = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'https://api.resend.com/emails') {
      emailRequests.push({body: JSON.parse(options.body), key: options.headers['Idempotency-Key']});
      return mailAvailable ? Response.json({id: 'receipt-fixture'}) : new Response(null, {status: 503});
    }
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
  await db.prepare("INSERT INTO lessons(id,course_id,video_key,video_url,position) VALUES('prep','gel','private-video-key',NULL,1)").run();
  assert.equal((await checkout()).status, 503); // Live merchant not connected.
  await db.prepare("INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at) VALUES('legacy-card','student','student@example.com','gel','Gel Foundations',6500,'gbp','pending','live','2026-01-01')").run();
  process.env.PUBLIC_PAYMENTS_READY = 'false';
  assert.equal((await checkout({orderId:'legacy-card'})).status,409);
  process.env.PUBLIC_PAYMENTS_READY = 'true';
  assert.equal((await checkout({orderId:'legacy-card'})).status,409);
  assert.equal((await checkout({test:true,handoff:true})).status,409);
  assert.equal(stripeForm,undefined);
  // Payments completed in a pre-existing legacy session still reconcile.
  await db.prepare("UPDATE orders SET session_id='cs_historical' WHERE id='legacy-card'").run();
  const order = await db.prepare('SELECT * FROM orders').first();
  const session = { id: order.session_id, status: 'complete', payment_status: 'paid', amount_total: 6500,
    currency: 'gbp', metadata: { orderId: order.id, courseId: 'gel' }, customer_email: 'student@example.com', livemode: true };
  assert.equal(await fulfill({ ...session, amount_total: 1 }), false);
  assert.equal((await db.prepare('SELECT * FROM enrollments').all()).results.length, 0);
  assert.equal(await fulfill(session), true);
  assert.equal(await fulfill(session), true);
  assert.equal((await db.prepare('SELECT * FROM enrollments').all()).results.length, 1);
  assert.equal(await sendOrderReceipt(order.id), 'unconfigured');
  assert.equal((await (await checkout()).json()).path, '/dashboard');

  globalThis.academyCheckoutIdentity = { user: {userId:'manual-student',email:'manual@example.com',sessionId:'mobile'} };
  process.env.PUBLIC_PAYMENTS_READY = 'false';
  assert.equal((await checkout({handoff:true})).status,409);
  const manual={orderId:'historical-manual'};
  await db.prepare("INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at) VALUES(?,'manual-student','manual@example.com','gel','Gel Foundations',6500,'gbp','pending','whatsapp','2026-01-01')").bind(manual.orderId).run();
  const privateEntry = await import(await compile('app/(website)/orders/[id]/learn/route.ts', {
    '@/app/chatgpt-auth': identity, '@/lib/course-orders': orderModule, '@/lib/server': server,
    '@/lib/student-course-link': privateUrls, '@/lib/course-invitation':invite,
  }));
  const openLink = () => privateEntry.GET(new Request('https://academy.example/orders/'+manual.orderId+'/learn'),
    {params:Promise.resolve({id:manual.orderId})});
  const orderPath = '/orders/'+manual.orderId;
  const buyer = globalThis.academyCheckoutIdentity.user;
  assert.equal(new URL((await openLink()).headers.get('Location')).pathname, orderPath);
  globalThis.academyCheckoutIdentity.user = null;
  const signInLink = new URL((await openLink()).headers.get('Location'));
  assert.equal(signInLink.pathname, '/sign-in');
  assert.equal(signInLink.searchParams.get('redirect_url'), orderPath+'/learn');
  globalThis.academyCheckoutIdentity.user = buyer;
  assert.ok(!await ownedOrder(manual.orderId,'stranger'));
  assert.equal((await ownedOrder(manual.orderId,'manual-student')).status,'pending');
  assert.equal((await db.prepare("SELECT id FROM enrollments WHERE email='manual@example.com'").all()).results.length,0);
  process.env.RESEND_API_KEY = 'fixture-only';
  process.env.ACADEMY_RECEIPT_FROM = 'Academy <academy@example.test>';
  assert.equal(await sendOrderReceipt(manual.orderId), 'ineligible');
  assert.equal(emailRequests.length, 0);
  assert.equal(await confirmManualPayment(manual.orderId), 'pending');
  assert.equal((await ownedOrder(manual.orderId,'manual-student')).status, 'paid');
  mailAvailable = true;
  assert.equal(await sendOrderReceipt(manual.orderId), 'sent');
  assert.equal(await confirmManualPayment(manual.orderId), 'sent');
  assert.equal(emailRequests.length, 2);
  assert.deepEqual(emailRequests[0], emailRequests[1]);
  assert.equal(emailRequests[1].key, 'academy-receipt/' + manual.orderId);
  assert.deepEqual(emailRequests[1].body.to, ['manual@example.com']);
  assert.ok(emailRequests[1].body.text.includes('£65.00'));
  assert.match(emailRequests[1].body.text,/https:\/\/academy.example\/orders\/s1_[\w-]+\/learn/);
  assert.equal(new URL((await openLink()).headers.get('Location')).pathname, '/learn/prep');
  assert.equal((await openLink()).headers.get('Cache-Control'), 'private, no-store');
  await db.prepare("INSERT INTO lessons(id,course_id,video_key,video_url,position) VALUES('shape','gel','another-private-key',NULL,2)").run();
  assert.equal((await ownedOrder(manual.orderId,'manual-student')).status,'paid');
  assert.equal((await db.prepare("SELECT id FROM enrollments WHERE email='manual@example.com'").all()).results.length,1);

  const lessonModules = {'@/lib/lesson-quiz':await compile('lib/lesson-quiz.ts',{}),
    '@/lib/server': server, '@/app/chatgpt-auth': identity,
    '@/lib/video-security': await compile('lib/video-security.ts', {}),
  };
  const token = await import(await compile('app/api/video-access/route.ts', lessonModules));
  const playback = await import(await compile('app/api/video/[id]/route.ts', lessonModules));
  const progress = await import(await compile('app/api/progress/route.ts', lessonModules));
  const forLesson = path => new Request('https://academy.example' + path, {
    method: 'POST', headers: {origin: 'https://academy.example', 'Content-Type': 'application/json'},
    body: JSON.stringify({lessonId: 'prep'}),
  });
  const tokenResponse = await token.POST(forLesson('/api/video-access'));
  assert.equal(tokenResponse.status, 200);
  const streamUrl = new URL((await tokenResponse.json()).url, 'https://academy.example');
  const readVideo = () => playback.GET(new Request(streamUrl, {headers: {Range: 'bytes=0-15'}}),
    {params: Promise.resolve({id: 'prep'})});
  const stream = await readVideo();
  assert.equal(stream.status, 206);
  assert.equal((await stream.arrayBuffer()).byteLength, 16);
  assert.equal((await progress.POST(forLesson('/api/progress'))).status, 200);
  assert.equal((await db.prepare('SELECT user_id FROM progress').first()).user_id, 'manual-student');
  assert.equal(new URL((await openLink()).headers.get('Location')).pathname, '/learn/shape');
  globalThis.academyCheckoutIdentity.user = {...buyer,sessionId:'second-browser'};
  assert.equal((await readVideo()).status, 403);
  assert.equal((await token.POST(forLesson('/api/video-access'))).status, 200);
  globalThis.academyCheckoutIdentity.user = {userId: 'outsider', email: 'outsider@example.test'};
  assert.equal((await readVideo()).status, 403);
  assert.equal((await progress.POST(forLesson('/api/progress'))).status, 403);
  assert.equal((await openLink()).status, 404);
  globalThis.academyCheckoutIdentity.user = buyer;
  await db.prepare("DELETE FROM enrollments WHERE id='buyer/manual-student/gel'").run();
  assert.equal(new URL((await openLink()).headers.get('Location')).pathname, orderPath);
  assert.equal((await readVideo()).status, 403);
  await confirmManualPayment(manual.orderId);
  assert.equal((await readVideo()).status, 403);

  // On a reused email, keep each buyer’s access independently revocable when upgrading an old enrolment.
  await db.prepare("UPDATE enrollments SET id=email||':'||course_id WHERE id='buyer/student/gel'").run();
  await db.prepare("INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode) VALUES('second-owner','next-owner','student@example.com','gel','Gel',6500,'gbp','pending','whatsapp')").run();
  await confirmManualPayment('second-owner');
  const accessIds = (await db.prepare("SELECT id FROM enrollments WHERE email='student@example.com' ORDER BY id").all()).results.map(row => row.id);
  assert.deepEqual(accessIds,['buyer/next-owner/gel','buyer/student/gel']);
  await db.prepare("DELETE FROM enrollments WHERE id='buyer/next-owner/gel'").run();
  const {enrolled} = await import(server);
  globalThis.academyCheckoutIdentity.user = {userId:'next-owner',email:'student@example.com'};
  assert.equal(await enrolled('gel'),false);
  globalThis.academyCheckoutIdentity.user = {userId:'student',email:'changed@example.com'};
  assert.equal(await enrolled('gel'),true);

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

test('a course enquiry is saved for staff and invalid requests leave the inbox unchanged', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE enquiries(id TEXT PRIMARY KEY, name TEXT, email TEXT, message TEXT, created_at TEXT)');
  globalThis.enquiryTestDatabase = db;
  try {
    const server = moduleUrl(`export const db = () => ({prepare: sql => ({bind: (...args) => ({
      run: () => globalThis.enquiryTestDatabase.prepare(sql).run(...args)
    })})});`);
  const { POST } = await import(await compile('app/api/enquiry/route.ts', {'@/lib/server': server}));
    const enquiry = {name: 'Student', email: 'student@example.test', interest: 'Course availability',
      message: 'When can I enrol in Gel Polish Foundations?'};
    const send = (body, origin = 'https://academy.example') => POST(new Request('https://academy.example/api/enquiry', {
      method: 'POST', headers: {origin, 'Content-Type':'application/json'}, body: JSON.stringify(body),
    }));
    assert.equal((await send(enquiry, 'https://another.example')).status, 403);
    assert.equal((await send({...enquiry, email:'incomplete'})).status, 400);
    assert.equal((await send({...enquiry, interest: {}})).status, 400);
    assert.equal((await send(enquiry)).status, 200);
    const entries = db.prepare('SELECT name,email,message FROM enquiries').all();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].email, enquiry.email);
    assert.ok(entries[0].message.includes(enquiry.message));
  } finally {
    delete globalThis.enquiryTestDatabase;
    db.close();
  }
});
