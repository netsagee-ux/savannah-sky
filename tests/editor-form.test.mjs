import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {compile} from './compile-fixture.mjs';

const formModule=await compile('lib/editor-form.ts',{});
const {encodeEditorForm,readEditorForm,maxEditorBodyBytes,maxEditorFileBytes}=await import(formModule);
const {submitEditorForm}=await import(await compile('components/submit-editor-form.ts',{'@/lib/editor-form':formModule}));
const request=body=>new Request('https://academy.test/api/admin',{method:'POST',headers:{'content-type':'application/json'},body});

test('course text, repeated date fields and original photo bytes survive the same JSON transport used by the editor',async()=>{
  const form=new FormData(),picture=await readFile('public/nail-pink-french.jpg');
  form.set('description','Carla’s class\r\nLine two: £199, café, آموزش 💅');
  for(const day of ['2027-01-20','2027-02-21'])form.append('courseDateDay',day);
  form.set('courseThumbnail',new File([picture],'Carla’s nails.jpg',{type:'image/jpeg'}));
  form.set('thumbnail',new File([],'',{type:'application/octet-stream'}));
  const body=await encodeEditorForm(form);
  assert.equal(JSON.parse(body).files.length,1);
  const decoded=await readEditorForm(request(body));
  assert.equal(decoded.get('description'),form.get('description'));
  assert.deepEqual(decoded.getAll('courseDateDay'),form.getAll('courseDateDay'));
  assert.equal(decoded.has('thumbnail'),false);
  assert.equal(decoded.get('courseThumbnail').name,'Carla’s nails.jpg');
  assert.deepEqual(Buffer.from(await decoded.get('courseThumbnail').arrayBuffer()),picture);
});

test('maximum-size cover fits the host body limit and arrives intact when the connection sends many chunks',async()=>{
  const bytes=Buffer.alloc(maxEditorFileBytes,173),form=new FormData();
  form.set('title','Maximum size cover');form.set('courseThumbnail',new File([bytes],'cover.jpg',{type:'image/jpeg'}));
  const body=Buffer.from(await encodeEditorForm(form));
  assert.ok(body.length<maxEditorBodyBytes);
  let offset=0;
  const stream=new ReadableStream({pull(controller){
    if(offset===body.length)return controller.close();
    const end=Math.min(offset+17003,body.length);controller.enqueue(body.subarray(offset,end));offset=end;
  }});
  const result=await readEditorForm(new Request('https://academy.test/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:stream,duplex:'half'}));
  assert.deepEqual(Buffer.from(await result.get('courseThumbnail').arrayBuffer()),bytes);
});

test('already-open editors retain multipart compatibility, including WebKit boundaries and empty image inputs',async()=>{
  const boundary='----WebKitFormBoundaryAaB03x';
  const body=`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nCarla’s course\r\n--${boundary}\r\nContent-Disposition: form-data; name="courseThumbnail"; filename=""\r\nContent-Type: application/octet-stream\r\n\r\n\r\n--${boundary}--\r\n`;
  const result=await readEditorForm(new Request('https://academy.test/api/admin',{method:'POST',headers:{'content-type':'multipart/form-data; boundary='+boundary},body}));
  assert.equal(result.get('title'),'Carla’s course');assert.equal(result.get('courseThumbnail').size,0);
});

test('broken boundaries and interrupted bodies produce an actionable error before any save',async()=>{
  const broken=new Request('https://academy.test/api/admin',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=missing'},body:'broken upload'});
  await assert.rejects(broken.clone().formData(),/parse body as FormData/);
  await assert.rejects(readEditorForm(broken),error=>error.status===400&&/Keep this editor open/.test(error.message));
  const body=await encodeEditorForm(new FormData());
  await assert.rejects(readEditorForm(request(body.slice(0,-1))),error=>error.status===400);
  await assert.rejects(readEditorForm(new Request('https://academy.test',{method:'POST',body:'x'})),error=>error.status===415);
});

test('oversized, malformed and mismatched files are rejected even without a Content-Length header',async()=>{
  const form=new FormData();form.set('photo',new File([new Uint8Array(maxEditorFileBytes+1)],'too-large.jpg'));
  await assert.rejects(encodeEditorForm(form),error=>error.status===413);
  await assert.rejects(readEditorForm(request('x'.repeat(maxEditorBodyBytes+1))),error=>error.status===413);
  for(const file of [
    {field:'photo',name:'a.jpg',type:'image/jpeg',size:3,data:'!@#$'},
    {field:'photo',name:'a.jpg',type:'image/jpeg',size:3,data:'YQ=='},
    {field:'photo',name:'a.jpg',type:'image/jpeg',size:-1,data:''},
  ])await assert.rejects(readEditorForm(request(JSON.stringify({version:1,fields:[],files:[file]}))),error=>error.status===400);
});

test('client submission uses JSON and reports non-JSON host failures without resetting fields',async t=>{
  const form=new FormData();form.set('title','Keep these edits');
  let status=200;
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(url,'/api/admin');assert.equal(init.headers['Content-Type'],'application/json');
    assert.equal((await readEditorForm(request(init.body))).get('title'),'Keep these edits');
    if(status===200)return Response.json({ok:true,courseId:'course'});
    return new Response('Host request error',{status});
  });
  assert.equal((await submitEditorForm('/api/admin',form)).result.courseId,'course');
  status=413;await assert.rejects(submitEditorForm('/api/admin',form),/image is too large/);
  status=502;await assert.rejects(submitEditorForm('/api/admin',form),/Keep this editor open/);
  status=403;assert.match((await submitEditorForm('/api/admin',form)).result.error,/sign in again/i);
  assert.equal(form.get('title'),'Keep these edits');
});
