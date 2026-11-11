import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {lessonUploadCourse,maxLessonBytes} from '../lib/lesson-upload.ts';

test('direct lesson uploads require the academy administrator, a same-origin request and a course-specific video path', async () => {
  const object = 'lessons/uploads/gel-101/3cf8eb7d-dd0f-453b-85a3-6317cd0d27c3.mp4';
  assert.equal(lessonUploadCourse(object),'gel-101');
  for (const key of [object+'.html', object.replace('gel-101','../gel-101'), 'lesson-1.mp4']) assert.equal(lessonUploadCourse(key),undefined);
  const {pathToFileURL} = await import('node:url');
  let source = await readFile('app/api/admin/video-upload/route.ts','utf8');
  source = source.replace(/import \{ handleUpload, type HandleUploadBody \} from '@vercel\/blob\/client';/,'const {handleUpload}=globalThis.uploadFixture;')
    .replace("import { admin, db } from '@/lib/server';",'const {admin,db}=globalThis.uploadFixture;')
    .replace("'@/lib/request-origin'",JSON.stringify(pathToFileURL(process.cwd()+'/lib/request-origin.ts').href))
    .replace("'@/lib/lesson-upload'",JSON.stringify(pathToFileURL(process.cwd()+'/lib/lesson-upload.ts').href));
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  let isAdmin=false;
  globalThis.uploadFixture={admin:async()=>isAdmin, db:()=>({prepare:()=>({bind:course=>({first:async()=>course==='gel-101'?{id:course}:null})})}),
    handleUpload:async({body,onBeforeGenerateToken})=>onBeforeGenerateToken(body.payload.pathname)};
  try {
    const {POST}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
    const request=(key=object,origin='https://example.test')=>new Request('https://example.test/api/admin/video-upload',{method:'POST',headers:{origin},body:JSON.stringify({type:'blob.generate-client-token',payload:{pathname:key}})});
    assert.equal((await POST(request())).status,403);
    isAdmin=true;
    assert.equal((await POST(request(object,'https://other.test'))).status,403);
    assert.equal((await POST(request(object.replace('gel-101','unknown')))).status,400);
    const result=await POST(request());
    assert.equal(result.status,200);
    const rules=await result.json();
    assert.deepEqual(rules.allowedContentTypes,['video/mp4','video/webm']);
    assert.equal(rules.allowOverwrite,false);
    assert.equal(rules.maximumSizeInBytes,maxLessonBytes);
  } finally {delete globalThis.uploadFixture;}
});
