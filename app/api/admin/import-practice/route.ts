import {createHash,timingSafeEqual} from 'node:crypto';
import {installPractice} from '@/lib/install-practice.mjs';

// A single release upload. Only the three pre-approved file digests are accepted.
// The release route is removed after the production import has been verified.
const expected=Buffer.from('caeb10227e10d56fb09ae2eeb29e8ff2ad78dcc6b01769a424810fff4f6c7984','hex');
export async function POST(request:Request) {
  const auth=request.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer ')||auth.length>128||
    !timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(),expected))return new Response(null,{status:403});
  const bytes=Number(request.headers.get('content-length'));
  if(!Number.isFinite(bytes)||bytes<1||bytes>1250000)return new Response(null,{status:413});
  try {
    const status=await installPractice(await request.formData());
    return Response.json({status},{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'Private lesson import failed.'},{status:422});}
}
