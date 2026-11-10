export function POST(){
  return Response.json({error:'Workspace access is restricted to authorised academy owners.'},{status:410,headers:{'Cache-Control':'no-store'}});
}
