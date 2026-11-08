const encoder = new TextEncoder();

function playbackKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, usage);
}

type Viewer = {userId: string; sessionId: string};

function playbackPayload(viewer: Viewer, lessonId: string, expires: number) {
  return encoder.encode(JSON.stringify(['academy-playback-v2', viewer.userId, viewer.sessionId, lessonId, expires]));
}

export async function signPlayback(viewer: Viewer, lessonId: string, expires: number, secret: string) {
  if (!viewer.userId || !viewer.sessionId) throw Error('Sign in to start playback.');
  const signature = await crypto.subtle.sign('HMAC', await playbackKey(secret, ['sign']), playbackPayload(viewer, lessonId, expires));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPlayback(viewer: Viewer, lessonId: string, expires: number, signature: string, secret: string, now = Date.now()) {
  const seconds = Math.floor(now / 1000);
  if (!viewer.userId || !viewer.sessionId || !Number.isSafeInteger(expires) || expires <= seconds || expires > seconds + 7200 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const bytes = Uint8Array.from(signature.match(/../g)!, value => parseInt(value, 16));
  return crypto.subtle.verify('HMAC', await playbackKey(secret, ['verify']), bytes, playbackPayload(viewer, lessonId, expires));
}
export function imageContentType(bytes:Uint8Array):string|null{if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';return null;}
export function parseRange(value:string|null,size:number):{offset:number;length:number}|null{if(!value)return null;const m=/^bytes=(\d*)-(\d*)$/.exec(value);if(!m||(!m[1]&&!m[2]))throw Error('Invalid range');let start:number,end:number;if(!m[1]){const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)throw Error('Invalid range');start=Math.max(0,size-suffix);end=size-1;}else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw Error('Invalid range');return {offset:start,length:end-start+1};}
