import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compile,moduleUrl} from './compile-fixture.mjs';

test('classroom uploads initialise once, run at most three parts concurrently, and resume only missing parts',async t=>{
  const config=await compile('lib/lesson-upload.ts',{});
  const {mediaPartBytes}=await import(config);
  const uploader=await import(await compile('components/upload-lesson-video.ts',{
    '@/lib/lesson-upload':config,'@vercel/blob/client':moduleUrl("export const upload=()=>{throw Error('Unexpected storage mode')}"),
  }));
  const bytes=Buffer.alloc(mediaPartBytes*5+111,0x55);
  const file=new File([bytes],'lesson.mp4',{type:'video/mp4'});
  const form=()=>{const data=new FormData();data.set('courseId','gel');data.set('video',file);return data;};
  const finished=new Set(),messages=[],keys=new Set();let firstDone=false,paused=true,active=0,maxActive=0;
  t.mock.method(globalThis,'fetch',async(path,options)=>{
    const params=new URL(path,'https://school.example').searchParams,part=Number(params.get('part'));
    keys.add(params.get('key'));if(part!==0)assert.ok(firstDone);
    assert.ok(!finished.has(part),'already uploaded part sent again');
    active++;maxActive=Math.max(maxActive,active);
    await new Promise(r=>setTimeout(r,5));active--;
    if(part===2&&paused)return new Response(null,{status:403});
    const expected=bytes.subarray(part*mediaPartBytes,(part+1)*mediaPartBytes);
    assert.deepEqual(Buffer.from(await options.body.arrayBuffer()),expected);
    finished.add(part);if(part===0)firstDone=true;
    return Response.json({ok:true});
  });
  await assert.rejects(uploader.uploadLessonVideo(form(),m=>messages.push(m),false),/staff session/);
  paused=false;
  const retry=form();await uploader.uploadLessonVideo(retry,m=>messages.push(m),false);
  assert.equal(keys.size,1);assert.equal(maxActive,3);
  assert.equal(finished.size,6);assert.equal(retry.has('video'),false);
  assert.equal(retry.get('uploadedVideoKey'),[...keys][0]);assert.ok(messages.includes('Uploading private video · 100%'));
});

test('staff sign-in restores only authorised workspace destinations',async()=>{
  const {staffDestination}=await import(await compile('lib/staff-navigation.ts',{}));
  assert.equal(staffDestination('/admin?tab=Lessons&courseId=gel'),'/admin?tab=Lessons&courseId=gel');
  assert.equal(staffDestination('/admin?tab=Courses&action=create'),'/admin?tab=Courses&action=create');
  assert.equal(staffDestination('/admin?tab=Payments&action=create'),'/admin?tab=Payments');
  for(const value of ['https://other.example/private','//other.example','/admin/../orders','/administer',null,[]])assert.equal(staffDestination(value),'/admin?tab=Lessons');
});

test('small recordings recover from a failed direct upload using authenticated private database parts',async t=>{
  const config=await compile('lib/lesson-upload.ts',{});
  const blob=moduleUrl("export const upload=async()=>{throw Error('Direct store unavailable')}");
  const {uploadLessonVideo}=await import(await compile('components/upload-lesson-video.ts',{
    '@/lib/lesson-upload':config,'@vercel/blob/client':blob,
  }));
  const file=new File(['example recording'],'lesson.webm',{type:'video/webm'});
  const form=()=>{const f=new FormData();f.set('courseId','art');f.set('video',file);return f;};
  let parts=0;
  t.mock.method(globalThis,'fetch',async (path,options)=>{
    assert.match(path,/^\/api\/admin\/video-part\?/);
    assert.equal(await options.body.text(),'example recording');parts++;return Response.json({ok:true});
  });
  const first=form();await uploadLessonVideo(first,()=>{},true);
  assert.match(first.get('uploadedVideoKey'),/^classroom\/art\//);
  const retry=form();await uploadLessonVideo(retry,()=>{},true);
  assert.equal(first.get('uploadedVideoKey'),retry.get('uploadedVideoKey'));assert.equal(parts,1);
});
