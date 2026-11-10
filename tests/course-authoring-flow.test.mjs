import assert from 'node:assert/strict';
import {readdir, readFile, mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {test} from 'node:test';
import {compile, moduleUrl} from './compile-fixture.mjs';

test('staff can publish fifteen recordings and earlier paid guest orders still activate once', async t => {
  const dir=await mkdtemp(join(tmpdir(),'academy-authoring-'));
  const env={TURSO_DATABASE_URL:'file:'+join(dir,'academy.db'), TURSO_AUTH_TOKEN:'test',
    CLERK_SECRET_KEY:'test',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:'test',APP_ENCRYPTION_KEY:'private-test-key',
    ACADEMY_WHATSAPP_NUMBER:'',BLOB_READ_WRITE_TOKEN:'',BLOB_STORE_ID:'',RESEND_API_KEY:'',STRIPE_SECRET_KEY:''};
  const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
  Object.assign(process.env,env);
  const files=new Map(), state={user:null};
  globalThis.authoringTest={state, storage:{
    async put(key,data,opts){files.set(key,{bytes:new Uint8Array(await new Response(data).arrayBuffer()),type:opts.httpMetadata.contentType});},
    async head(key){const file=files.get(key);return file?{size:file.bytes.length}:null;},
    async get(key,options){const file=files.get(key);if(!file)return null;const range=options?.range;
      return {body:range?file.bytes.slice(range.offset,range.offset+range.length):file.bytes,size:file.bytes.length,
        writeHttpMetadata:h=>h.set('Content-Type',file.type)};},
    async delete(keys){for(const key of [keys].flat())files.delete(key);},
  }};
  t.after(async()=>{delete globalThis.authoringTest;for(const [key,value] of Object.entries(previous)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }await rm(dir,{force:true,recursive:true});});

  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const parts=await compile('lib/lesson-upload.ts',{});
  const mediaModule=await compile('lib/classroom-media.ts',{'./vercel-database':adapter,'./lesson-upload':parts});
  const {classroomGet,classroomHead,storeMediaPart}=await import(mediaModule);
  const store=globalThis.authoringTest.storage, previousGet=store.get, previousHead=store.head;
  const encrypted=id=>id.startsWith('classroom/')||id.startsWith('classroom-assets/diagrams/');
  const originalPut=store.put;
  store.put=(id,bytes,opts)=>id.startsWith('classroom-assets/diagrams/')?
    storeMediaPart(id,{size:bytes.byteLength,type:opts.httpMetadata.contentType},0,Buffer.from(bytes)):originalPut(id,bytes,opts);
  store.get=(id,options)=>encrypted(id)?classroomGet(id,options):previousGet(id,options);
  store.head=id=>encrypted(id)?classroomHead(id):previousHead(id);
  const db=(await import(adapter)).database();
  for(const path of (await readdir('drizzle')).filter(path=>path.endsWith('.sql')).sort()){
    for(const sql of (await readFile('drizzle/'+path,'utf8')).split('--> statement-breakpoint')){
      if(sql.trim())await db.prepare(sql).run();
    }
  }
  const auth=moduleUrl("export const getChatGPTUser=async()=>globalThis.authoringTest.state.user; export const chatGPTSignInPath=path=>'/sign-in?redirect_url='+encodeURIComponent(path)");
  const server=await compile('lib/server.ts',{'./vercel-database':adapter,'./vercel-storage':moduleUrl('export const objectStorage=()=>globalThis.authoringTest.storage'),'@/app/chatgpt-auth':auth});
  const urls=await compile('lib/student-course-link.ts',{});
  const inviteModule=await compile('lib/course-invitation.ts',{'./server':server,'./student-course-link':urls});
  const receipt=await compile('lib/order-receipt.ts',{'./server':server,'./course-invitation':inviteModule});
  const orders=await compile('lib/course-orders.ts',{'./server':server,'./order-receipt':receipt});
  const security=await compile('lib/payment-security.ts',{});
  const payments=await compile('lib/payments.ts',{'./server':server,'./course-orders':orders,'./payment-security':security});
  const sumup=await compile('lib/sumup.ts',{'./server':server,'./course-orders':orders,'./course-invitation':inviteModule});
  const modules={'@/lib/data':await compile('lib/data.ts',{}),'@/lib/qualifications':await compile('lib/qualifications.ts',{'./server':server}),'@/lib/lesson-quiz':await compile('lib/lesson-quiz.ts',{}),'next/cache':moduleUrl('export const revalidatePath=()=>{}'),'@/lib/sumup':sumup,'@/lib/course-invitation':inviteModule,'@/lib/server':server,'@/lib/course-orders':orders,'@/lib/order-receipt':receipt,'@/lib/payments':payments,
    '@/lib/payment-security':security,'@/lib/video-security':await compile('lib/video-security.ts',{}),'@/app/chatgpt-auth':auth,
    '@/lib/classroom-media':mediaModule,'@/lib/lesson-upload':parts,'@/lib/student-course-link':urls,'@vercel/blob':import.meta.resolve('@vercel/blob')};
  const photoTypes=await compile('lib/lesson-photos.ts',{});
  modules['@/lib/lesson-photos']=photoTypes;
  modules['@/lib/save-lesson-photos']=await compile('lib/save-lesson-photos.ts',{'./server':server,'./lesson-photos':photoTypes});
  const route=async path=>import(await compile(path,modules));
  const author=await route('app/api/admin/route.ts'), checkout=await route('app/api/checkout/route.ts');
  const pay=await route('app/api/payments/route.ts'), entry=await route('app/(website)/orders/[id]/learn/route.ts');
  const token=await route('app/api/video-access/route.ts'),stream=await route('app/api/video/[id]/route.ts');
  const origin='https://academy.example';
  const post=(path,fields)=>new Request(origin+path,{method:'POST',headers:{origin,...(fields instanceof FormData?{}:{'Content-Type':'application/json'})},body:fields instanceof FormData?fields:JSON.stringify(fields)});
  const save=(action,data)=>{const form=new FormData();form.set('action',action);for(const [k,v] of Object.entries(data))form.set(k,v);return author.POST(post('/api/admin',form));};
  const payment=data=>pay.POST(post('/api/payments',data));
  const owner={userId:'teacher',email:'netsagee@gmail.com',sessionId:'staff'};
  const buyer={userId:'student-a',email:'learner@example.test',sessionId:'phone'};
  const stranger={userId:'student-b',email:'other@example.test',sessionId:'tablet'};
  const course={title:'Studio practice',description:'A private training demonstration.',level:'Beginner',price:'49.50',published:'0',format:'classroom',classDates:'Private classroom joining notes'};
  assert.equal((await save('course',course)).status,403);
  const educator={userId:'educator',email:'educator@example.test',sessionId:'studio'};
  // A historical educator assignment can no longer open or change academy records.
  await db.prepare("INSERT INTO settings(id,value) VALUES('academy_staff_email',?)").bind(educator.email).run();
  state.user=educator;
  assert.equal((await author.GET(new Request(origin+'/api/admin'))).status,403);
  assert.equal((await save('course',course)).status,403);
  state.user=owner;
  const creationId=crypto.randomUUID();
  const create=()=>save('course',{...course,creationId});
  const courseId=(await (await create()).json()).courseId;
  assert.equal(courseId,creationId);
  assert.equal((await (await create()).json()).courseId,courseId);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM courses').first()).n,1);
  assert.ok(courseId);
  const edited=await (await author.GET(new Request(origin+'/api/admin?tab=Courses'))).json();
  assert.equal(edited.courses[0].format,'classroom');
  assert.equal(edited.courses[0].class_dates,'Private classroom joining notes');
  const directory=(await import(server)).catalog;
  assert.ok((await save('visibility',{id:courseId,published:'1'})).ok);
  assert.ok((await directory()).some(item=>item.id===courseId));
  assert.ok(!JSON.stringify(await directory()).includes('Private classroom joining notes'));
  assert.ok((await save('course',{...course,id:courseId,published:'1',format:'online'})).ok);
  assert.ok(!(await directory()).some(item=>item.id===courseId));
  assert.ok((await save('course',{...course,id:courseId})).ok);
  const lesson={courseId,title:'Prepare the nail',position:'1'};
  assert.equal((await save('lesson',lesson)).status,400);
  // A two-frame, 32px VP9 recording. The actual upload and streaming handlers round-trip its bytes.
  const video=Buffer.from('GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAH6EU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEjTbuMU6uEHFO7a1OsggHk7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjEuNy4xMDNXQYxMYXZmNjEuNy4xMDNEiYhAeQAAAAAAABZUrmvIrgEAAAAAAAA/14EBc8WIpvfJr9g5ExucgQAitZyDdW5kiIEAhoVWX1ZQOYOBASPjg4QL68IA4JCwgSC6gSCagQJVsIRVuYEBElTDZ0B/c3OfY8CAZ8iZRaOHRU5DT0RFUkSHjExhdmY2MS43LjEwM3Nz2mPAi2PFiKb3ya/YORMbZ8ilRaOHRU5DT0RFUkSHmExhdmM2MS4xOS4xMDEgbGlidnB4LXZwOWfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDAuNDAwMDAwMDAwAB9DtnW354EAo52BAACAgkmDQgAB8AH2ADgkHBhKAAAwYAAAItXAAKOTgQDIAIYAQJKcAFAAAAMgAABDQBxTu2uRu4+zgQC3iveBAfGCAajwgQM=','base64');
  const file=new File([video],'studio.webm',{type:'video/webm'});
  const firstLesson=crypto.randomUUID();
  const createLesson=()=>save('lesson',{...lesson,creationId:firstLesson,video:file});
  assert.ok((await Promise.all([createLesson(),createLesson()])).every(response=>response.ok));
  const lessonId=(await db.prepare('SELECT id FROM lessons WHERE course_id=?').bind(courseId).first()).id;
  assert.equal((await save('lesson',{...lesson,id:lessonId,removeVideo:'1'})).status,400);
  const uploadPhoto=await route('app/api/admin/lesson-photos/route.ts');
  const viewPhoto=await route('app/api/lesson-photos/[lessonId]/[photoId]/route.ts');
  const thumb=await route('app/api/thumbnail/[id]/route.ts');
  const photoId=crypto.randomUUID(), secondId=crypto.randomUUID();
  const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNicAAAAASUVORK5CYII=','base64');
  const pushPhoto=(image,bytes=picture,toLesson=lessonId)=>uploadPhoto.POST(new Request(origin+'/api/admin/lesson-photos?'+new URLSearchParams({lesson:toLesson,course:courseId,image}),{method:'POST',headers:{origin},body:bytes}));
  const readPhoto=(id=photoId,target=lessonId)=>viewPhoto.GET(new Request(origin+'/photo'),{params:Promise.resolve({lessonId:target,photoId:id})});
  const readThumb=()=>thumb.GET(new Request(origin+'/thumb'),{params:Promise.resolve({id:lessonId})});
  assert.equal((await pushPhoto(photoId,Buffer.from('this is not a photo'))).status,415);
  assert.ok((await pushPhoto(photoId)).ok);
  assert.equal((await readPhoto()).status,404);
  assert.ok((await pushPhoto(secondId)).ok);
  const edits={...lesson,id:lessonId,addPhotos:JSON.stringify([{id:photoId,caption:'Gel layers'},{id:secondId,caption:'Nail anatomy'}])};
  assert.ok((await save('lesson',{...edits,thumbnail:new File([picture],'cover.png',{type:'image/png'})})).ok);
  assert.ok((await save('lesson',edits)).ok);
  assert.equal((await save('lesson',{...edits,addPhotos:JSON.stringify([{id:crypto.randomUUID(),caption:''}])})).status,400);
  const listPhotos=async()=>JSON.parse((await (await author.GET(new Request(origin+'/api/admin?tab=Lessons&courseId='+courseId))).json()).lessons.find(l=>l.id===lessonId).photos_json);
  assert.deepEqual(await listPhotos(),[{id:photoId,caption:'Gel layers'},{id:secondId,caption:'Nail anatomy'}]);
  assert.ok((await save('visibility',{id:courseId,published:'1'})).ok);
  state.user=null;
  assert.equal((await pushPhoto(photoId)).status,403);
  assert.ok((await readThumb()).ok);
  assert.equal((await readPhoto()).status,404);
  state.user=owner;
  assert.ok((await save('lesson',{...lesson,id:lessonId,removeThumbnail:'private',removePhoto:secondId})).ok);
  const gallery=await listPhotos();assert.equal(gallery.length,2);
  assert.equal((await readThumb()).status,404); assert.equal((await readPhoto(secondId)).status,404);
  assert.deepEqual(Buffer.from(await (await readPhoto(gallery[1].id)).arrayBuffer()),picture);
  const photoOnly=crypto.randomUUID(), standalone=crypto.randomUUID();
  assert.ok((await pushPhoto(standalone,picture,photoOnly)).ok);
  assert.ok((await save('lesson',{courseId,creationId:photoOnly,title:'Anatomy diagrams',position:'20',addPhotos:JSON.stringify([{id:standalone,caption:'Anatomy'}])})).ok);
  assert.equal((await save('lesson',{id:photoOnly,courseId,title:'Anatomy diagrams',position:'20',removePhoto:standalone})).status,400);
  assert.equal((await readPhoto(photoId,photoOnly)).status,404);
  // Simulate a later upload triggering the normal abandoned-file cleanup.
  await db.prepare("UPDATE classroom_files SET created_at=0 WHERE id LIKE 'classroom-assets/diagrams/%'").run();
  assert.ok((await pushPhoto(crypto.randomUUID())).ok);
  assert.equal((await readPhoto()).status,200);
  assert.equal((await readPhoto(gallery[1].id)).status,200);
  assert.equal(await classroomHead('classroom-assets/diagrams/'+courseId+'/'+lessonId+'/'+secondId),null);
  const partRoute=await route('app/api/admin/video-part/route.ts');
  const {mediaPartBytes}=await import(parts);
  const partRequest=(key,size,index,bytes)=>partRoute.POST(new Request(origin+'/api/admin/video-part?'+new URLSearchParams({key,size:String(size),part:String(index)}),{
    method:'POST',headers:{origin,'content-type':'video/webm'},body:bytes}));
  let largerVideo;
  for(let position=2;position<=15;position++){
    const key='classroom/'+courseId+'/'+crypto.randomUUID();
    const bytes=position===15?Buffer.concat([video,Buffer.alloc(mediaPartBytes,0x3a)]):video;
    assert.equal((await partRequest(key,bytes.length,0,bytes.subarray(0,mediaPartBytes))).status,200);
    if(position===15){
      largerVideo=bytes;
      assert.equal(await classroomHead(key),null);
      assert.equal((await save('lesson',{...lesson,uploadedVideoKey:key})).status,400);
      assert.equal((await partRequest(key,bytes.length,0,bytes.subarray(0,mediaPartBytes))).status,200);
      assert.equal((await partRequest(key,bytes.length,1,bytes.subarray(mediaPartBytes))).status,200);
      const atRest=await db.prepare('SELECT content FROM classroom_parts WHERE file_id=? AND position=0').bind(key).first();
      assert.ok(!Buffer.from(atRest.content).includes(video));
      const fragment=await classroomGet(key,{range:{offset:mediaPartBytes-20,length:46}});
      assert.deepEqual(Buffer.from(await new Response(fragment.body).arrayBuffer()),bytes.subarray(mediaPartBytes-20,mediaPartBytes+26));
    }
    const saved=await save('lesson',{...lesson,title:'Practice '+position,position:String(position),uploadedVideoKey:key});
    assert.equal(saved.status,200,await saved.text());
  }
  const roster=(await db.prepare('SELECT id,position FROM lessons WHERE course_id=? AND video_key IS NOT NULL ORDER BY position').bind(courseId).all()).results;
  assert.deepEqual(roster.map(row=>row.position),Array.from({length:15},(_,i)=>i+1));
  const lessonTab=await (await author.GET(new Request(origin+'/api/admin?tab=Lessons&courseId='+courseId))).json();
  assert.equal(lessonTab.lessons.length,16);
  const library=await (await author.GET(new Request(origin+'/api/admin?tab=Lessons'))).json();
  assert.equal(library.lessons.length,0);
  assert.equal(library.courses.find(c=>c.id===courseId).lesson_count,16);
  assert.equal(library.metrics,null);
  assert.equal(lessonTab.enquiries.length,0);
  const courseTab=await (await author.GET(new Request(origin+'/api/admin?tab=Courses'))).json();
  assert.equal(courseTab.lessons.length,0);
  assert.equal(courseTab.courses.find(c=>c.id===courseId).lesson_count,16);
  assert.equal(courseTab.courses.find(c=>c.id===courseId).videos,15);
  const watch=()=>token.POST(post('/api/video-access',{lessonId}));
  state.user=owner;
  assert.equal((await save('visibility',{id:courseId,published:'1'})).status,200);
  async function historicalGuestOrder(email){
    const id=crypto.randomUUID();
    await db.batch([db.prepare("INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at) VALUES(?,?,?,?,?,4950,'gbp','pending','whatsapp',?)").bind(id,'guest/'+id,email,courseId,course.title,new Date().toISOString()),
      db.prepare('INSERT INTO settings(id,value) VALUES(?,?)').bind('order_activation:'+id,'1')]);
    return id;
  }
  const orderId=await historicalGuestOrder(buyer.email);
  state.user=null;
  const open=()=>entry.GET(new Request(origin+'/orders/'+orderId+'/learn'),{params:Promise.resolve({id:orderId})});
  const confirm=()=>payment({action:'confirm-whatsapp',id:orderId});
  assert.equal((await confirm()).status,403);
  state.user=buyer;
  assert.equal((await confirm()).status,403);
  assert.equal(new URL((await open()).headers.get('location')).pathname,'/orders/'+orderId);
  assert.equal((await watch()).status,403);
  state.user=owner;
  assert.equal((await payment({action:'course-password',id:orderId})).status,409);
  assert.equal((await confirm()).status,200);
  const {password,path}=await (await payment({action:'course-password',id:orderId})).json();
  assert.match(password,/^[A-F0-9]{4}(-[A-F0-9]{4}){3}$/);
  const ticket=path.split('/')[2];
  const openInvite=(token=ticket)=>entry.GET(new Request(origin+'/orders/'+token+'/learn'),{params:Promise.resolve({id:token})});
  assert.match(ticket,/^s1_/);
  assert.ok(!path.includes(orderId));
  assert.equal((await openInvite(ticket.slice(0,-2)+'!!')).status,404);
  assert.equal((await openInvite(ticket.slice(0,10)+(ticket[10]==='a'?'b':'a')+ticket.slice(11))).status,404);
  const activation=await route('app/api/orders/[id]/activate/route.ts');
  const unlock=(value)=>activation.POST(post('/api/orders/'+orderId+'/activate',{password:value}),{params:Promise.resolve({id:orderId})});
  const lookup=()=>pay.GET(new Request(origin+'/api/payments?order='+orderId));
  assert.equal((await (await lookup()).json()).orders[0].awaitingClaim,1);
  assert.equal((await db.prepare('SELECT * FROM enrollments').all()).results.length,0);
  state.user=null;
  assert.equal(new URL((await open()).headers.get('location')).pathname,'/sign-in');
  state.user=stranger;
  assert.equal((await readPhoto()).status,404);
  assert.equal((await openInvite()).status,404);
  assert.equal((await unlock(password)).status,403);
  assert.equal((await open()).status,404);
  assert.equal((await watch()).status,403);
  state.user=buyer;
  // An older purchase under the same email must retain its own revocable entitlement.
  await db.prepare("INSERT INTO orders(id,user_id,email,course_id,title,amount,currency,status,mode,created_at) VALUES('older','former-owner',?,?,?,4950,'gbp','paid','live','2025-12-01')").bind(buyer.email,courseId,course.title).run();
  await db.prepare('INSERT INTO enrollments(id,email,course_id) VALUES(?,?,?)').bind(buyer.email+':'+courseId,buyer.email,courseId).run();
  const {claimPaidOrders}=await import(orders);
  await claimPaidOrders(buyer);
  assert.equal((await unlock('0000-1111-2222-3333')).status,403);
  assert.equal((await watch()).status,403);
  const activations=await Promise.all([unlock(password),unlock(password)]);
  assert.ok(activations.every(result=>result.ok));
  assert.equal(new URL((await open()).headers.get('location')).pathname,'/learn/'+lessonId);
  assert.equal(new URL((await openInvite()).headers.get('location')).pathname,'/learn/'+lessonId);
  const privateResponse=await readPhoto();
  assert.equal(privateResponse.status,200);assert.equal(privateResponse.headers.get('Content-Type'),'image/png');
  assert.match(privateResponse.headers.get('Cache-Control'),/no-store/);
  assert.deepEqual(Buffer.from(await privateResponse.arrayBuffer()),picture);
  for(const row of roster){
    const result=await token.POST(post('/api/video-access',{lessonId:row.id}));
    assert.equal(result.status,200);
    const address=(await result.json()).url;
    const bytes=await stream.GET(new Request(origin+address),{params:Promise.resolve({id:row.id})});
    assert.deepEqual(Buffer.from(await bytes.arrayBuffer()),row.position===15?largerVideo:video);
  }
  const progress=await route('app/api/progress/route.ts');
  const checkpoint=async values=>progress.POST(post('/api/progress',{lessonId,...values}));
  const before=await (await watch()).json();
  assert.equal(before.seconds,0);
  const savePlace={action:'bookmark',seconds:42,bookmark:before.bookmark};
  assert.equal((await checkpoint(savePlace)).status,200);
  state.user={...buyer,sessionId:'another-device'};
  assert.equal((await (await watch()).json()).seconds,42);
  assert.equal((await checkpoint({...savePlace,seconds:-1})).status,400);
  assert.equal((await checkpoint({...savePlace,bookmark:'other-recording'})).status,409);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM progress').first()).n,0);
  state.user=owner;
  assert.equal((await (await watch()).json()).seconds,0);
  assert.equal((await checkpoint(savePlace)).status,409);
  state.user=buyer;
  const playbackUrl=(await (await watch()).json()).url;
  const play=()=>stream.GET(new Request(origin+playbackUrl),{params:Promise.resolve({id:lessonId})});
  assert.deepEqual(Buffer.from(await (await play()).arrayBuffer()),video);
  state.user={...stranger,email:buyer.email};
  assert.equal((await open()).status,404);
  assert.equal((await play()).status,403);
  state.user=owner;
  assert.equal((await (await lookup()).json()).orders[0].awaitingClaim,0);
  assert.equal((await save('revoke',{id:'buyer/'+buyer.userId+'/'+courseId})).status,200);
  assert.equal((await confirm()).status,200);
  assert.equal((await payment({action:'course-password',id:orderId})).status,409);
  state.user=buyer;
  await claimPaidOrders(buyer);
  assert.equal((await readPhoto()).status,404);
  assert.equal((await play()).status,403);
  assert.equal((await checkpoint(savePlace)).status,403);
  assert.ok(await db.prepare('SELECT id FROM enrollments WHERE id=?').bind('buyer/former-owner/'+courseId).first());
  assert.equal(new URL((await open()).headers.get('location')).pathname,'/orders/'+orderId);
  state.user=null;
  const invite=await historicalGuestOrder(stranger.email);
  state.user=owner;
  assert.equal((await payment({action:'confirm-whatsapp',id:invite})).status,200);
  assert.equal((await payment({action:'withdraw-claim',id:invite})).status,200);
  state.user=stranger;
  await claimPaidOrders(stranger);
  assert.equal((await watch()).status,403);
  await t.test('educator authors quiz-only lessons, learners must answer every question, legacy edits preserve extra questions',async()=>{
    state.user=owner;
    const id=crypto.randomUUID(),qs=[{question:'First step?',options:['Prepare','Finish'],answer:0},{question:'Next step?',options:['Oil','Apply base','Wipe'],answer:1}];
    const base={...lesson,id:'',creationId:id,title:'Studio quiz',position:'16'};
    assert.equal((await save('lesson',{...base,quiz:JSON.stringify([{...qs[0],answer:6}])})).status,400);
    assert.equal((await save('lesson',{...base,quiz:JSON.stringify(qs)})).status,200);
    assert.equal((await save('lesson',{...base,id,question:'Prepare first?',option0:'Yes',option1:'No',option2:'Maybe',answer:0})).status,200);
    const listed=await (await author.GET(new Request(origin+'/api/admin?tab=Lessons&courseId='+courseId))).json();
    assert.equal(JSON.parse(listed.lessons.find(l=>l.id===id).quiz_json).length,2);
    await db.prepare('INSERT OR IGNORE INTO enrollments(id,email,course_id) VALUES(?,?,?)').bind('buyer/'+buyer.userId+'/'+courseId,buyer.email,courseId).run();
    state.user=buyer;
    for(const data of [{answer:0},{answers:[0]},{answers:[0,0]},{answers:[0,1,1]}])
      assert.equal((await progress.POST(post('/api/progress',{lessonId:id,...data}))).status,400);
    assert.equal((await progress.POST(post('/api/progress',{lessonId:id,answers:[0,1]}))).status,200);
  });
  await t.test('conversion certificate is private and only staff approval unlocks checkout eligibility',async()=>{
    state.user=owner;
    const conversion=(await (await save('course',{...course,title:'Builder conversion',level:'Conversion',published:'1'})).json()).courseId;
    const quals=await route('app/api/qualifications/route.ts');
    const submit=(values)=>{const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return quals.POST(post('/api/qualifications',f));};
    state.user=buyer;
    const buy=()=>checkout.POST(post('/api/checkout',{courseId:conversion}));
    assert.match((await (await buy()).json()).error,/approve your nail qualification/);
    assert.equal((await submit({action:'submit',courseId:conversion,proof:new File(['%PDF-1.5 example fixture'],'certificate.pdf')})).status,200);
    assert.equal((await quals.GET(new Request(origin+'/api/qualifications'))).status,403);
    state.user=owner;const pending=(await (await quals.GET(new Request(origin+'/api/qualifications'))).json()).requests;
    assert.equal(pending.length,1);const request=pending[0].id;
    assert.equal((await quals.GET(new Request(origin+'/api/qualifications?id='+request))).status,200);
    state.user=buyer;assert.equal((await submit({action:'approve',id:request})).status,403);
    state.user=owner;assert.equal((await submit({action:'approve',id:request})).status,200);
    assert.equal((await quals.GET(new Request(origin+'/api/qualifications?id='+request))).status,404);
    state.user=buyer;assert.doesNotMatch((await (await buy()).json()).error,/approve your nail qualification/);
  });

});
