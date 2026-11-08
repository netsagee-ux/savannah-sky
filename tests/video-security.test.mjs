import {test} from 'node:test';import assert from 'node:assert/strict';import {signPlayback,verifyPlayback,parseRange,imageContentType} from '../lib/video-security.ts';
test('playback signatures bind the buyer, login session, lesson and expiry', async () => {
  const now = Date.now(), expires = Math.floor(now / 1000) + 60;
  const buyer = {userId:'buyer', sessionId:'first-session'};
  const signature = await signPlayback(buyer, 'lesson', expires, 'secret');
  const verify = (viewer, lesson='lesson', end=expires, sig=signature, secret='secret', time=now) =>
    verifyPlayback(viewer,lesson,end,sig,secret,time);
  assert.ok(await verify(buyer));
  assert.equal(await verify({...buyer, userId:'other'}), false);
  assert.equal(await verify({...buyer, sessionId:'second-session'}), false);
  assert.equal(await verify({...buyer, sessionId:''}), false);
  assert.equal(await verify(buyer,'other'), false);
  assert.equal(await verify(buyer,'lesson',expires+1), false);
  assert.equal(await verify(buyer,'lesson',expires,'0'.repeat(64)), false);
  assert.equal(await verify(buyer,'lesson',expires,signature,'wrong'), false);
  assert.equal(await verify(buyer,'lesson',expires,signature,'secret',now+60000), false);
});
test('video seeking accepts closed, open and suffix ranges; rejects invalid/multi ranges',()=>{assert.deepEqual(parseRange('bytes=0-99',1000),{offset:0,length:100});assert.deepEqual(parseRange('bytes=950-',1000),{offset:950,length:50});assert.deepEqual(parseRange('bytes=-100',1000),{offset:900,length:100});assert.deepEqual(parseRange('bytes=950-1200',1000),{offset:950,length:50});assert.equal(parseRange(null,1000),null);for(const s of ['bytes=1000-','bytes=90-10','bytes=0-1,5-9','bytes=-0','bytes=-','garbage'])assert.throws(()=>parseRange(s,1000));});
test('thumbnail validation checks file content, not client MIME claims',()=>{assert.equal(imageContentType(new Uint8Array([255,216,255,1])),'image/jpeg');assert.equal(imageContentType(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');assert.equal(imageContentType(new TextEncoder().encode('<svg onload="alert(1)">')),null);});
