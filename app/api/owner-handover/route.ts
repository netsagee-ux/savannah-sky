import {completeOwnerHandover} from '@/lib/server';

export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin) {
    return Response.json({error:'Invalid origin.'},{status:403});
  }
  try {
    if(!await completeOwnerHandover())return Response.json({error:'Sign in using the verified salon owner account.'},{status:403});
    return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return Response.json({error:'The handover could not be saved. Please try again.'},{status:503});
  }
}
