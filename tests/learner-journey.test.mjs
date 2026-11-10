import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('student library, quizzes, lesson return links and certificate follow the verified learner',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'academy-learn-'));
  const env={TURSO_DATABASE_URL:'file:'+join(dir,'course.db'),TURSO_AUTH_TOKEN:'test'};
  const old=Object.keys(env).map(key=>[key,process.env[key]]);
  Object.assign(process.env,env);
  t.after(async()=>{for(const [key,value] of old){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    delete globalThis.journeyUser;await rm(dir,{force:true,recursive:true});});
  const base='https://academy.example';
  const auth=moduleUrl(`export const getChatGPTUser=async()=>globalThis.journeyUser;
    export const requireChatGPTUser=async dest=>{if(!globalThis.journeyUser)throw Error('login '+dest);return globalThis.journeyUser;};`);
  const adapter=await compile('lib/vercel-database.ts',{'@libsql/client':import.meta.resolve('@libsql/client')});
  const db=(await import(adapter)).database();
  for(const file of (await readdir('drizzle')).filter(s=>s.endsWith('.sql')).sort()){
    for(const line of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))
      if(line.trim())await db.prepare(line).run();
  }
  const server=await compile('lib/server.ts',{'./vercel-database':adapter,'./vercel-storage':moduleUrl('export const objectStorage=()=>({})'),'@/app/chatgpt-auth':auth});
  const orders=await compile('lib/course-orders.ts',{'./server':server,'./order-receipt':moduleUrl('export const sendOrderReceipt=async()=>{},activationPassword=()=>null')});
  const urls=await compile('lib/student-course-link.ts',{});
  const desk=await compile('components/student-desk.tsx',{'lucide-react':import.meta.resolve('lucide-react'),'@/lib/student-course-link':urls});
  const noop=moduleUrl('export default function Component(){return null;}');
  const imports={'@/lib/lesson-quiz':await compile('lib/lesson-quiz.ts',{}),'next/navigation':moduleUrl("export const redirect=p=>{throw Error(p)},notFound=()=>{throw Error('404')}"),
    '@/app/chatgpt-auth':auth,'@/lib/server':server,'@/lib/course-orders':orders,'@/components/student-desk':desk,
    '@/lib/video-security':await compile('lib/video-security.ts',{}),'@/components/print-button':noop,
    '@/components/lesson-player':noop,'@/components/course-playlist':noop};
  const page=async path=>(await import(await compile(path,imports))).default;
  const dashboard=await page('app/(website)/dashboard/page.tsx'),cert=await page('app/(website)/certificate/[id]/page.tsx');
  const lesson=await page('app/(website)/learn/[id]/page.tsx');
  const progress=await import(await compile('app/api/progress/route.ts',imports));
  const submit=(lessonId,answer)=>progress.POST(new Request(base+'/api/progress',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({lessonId,answer})}));
  const params=id=>({params:Promise.resolve({id})});
  const record=async()=>renderToStaticMarkup(await cert(params('gel')));
  const home=async()=>renderToStaticMarkup(await dashboard({searchParams:Promise.resolve({})}));
  await db.batch([db.prepare("INSERT INTO courses(id,title,description,level,published) VALUES('gel','Gel studio','','Beginner',1)"),
    db.prepare("INSERT INTO lessons(id,course_id,title,body,question,options,answer,position) VALUES('intro','gel','Preparation','Notes','Choose the answer','[\"A\",\"B\",\"C\"]',1,1),('finish','gel','Finish','Notes',NULL,NULL,NULL,2)"),
    db.prepare("INSERT INTO enrollments(id,email,course_id) VALUES('buyer/learner/gel','learner@example.test','gel')")]);
  globalThis.journeyUser=null;
  await assert.rejects(lesson(params('intro')),/login \/learn\/intro/);
  await assert.rejects(cert(params('gel')),/login \/certificate\/gel/);
  assert.equal((await submit('intro',1)).status,401);
  globalThis.journeyUser={userId:'learner',email:'learner@example.test',displayName:'Test Learner',fullName:'Test Learner',sessionId:'one'};
  assert.doesNotMatch(await home(),/href="\/learn\/intro"/);
  assert.match(renderToStaticMarkup(await lesson(params('intro'))),/Private course/);
  assert.equal((await submit('intro',1)).status,403);
  await db.prepare("INSERT INTO orders(id,user_id,email,course_id,title,amount,status,mode,created_at) VALUES('verified','learner','learner@example.test','gel','Gel studio',3500,'paid','sumup','2026-01-01')").run();
  assert.match(await home(),/href="\/learn\/intro"/);
  assert.match(await record(),/0 of 2 lessons complete/);
  assert.equal((await submit('intro',0)).status,400);
  assert.equal((await submit('intro',1)).status,200);
  assert.match(await home(),/href="\/learn\/finish"/);
  assert.match(await record(),/1 of 2 lessons complete/);
  assert.ok((await Promise.all([submit('finish'),submit('finish')])).every(r=>r.ok));
  assert.match(await home(),/href="\/certificate\/gel"/);
  const certificate=await record();assert.match(certificate,/Certificate of completion/);assert.match(certificate,/Test Learner/);
  globalThis.journeyUser={...globalThis.journeyUser,userId:'different'};
  assert.equal((await submit('finish')).status,403);
  assert.doesNotMatch(await record(),/Certificate of completion/);
  assert.doesNotMatch(await home(),/href="\/learn\/intro"/);
});
