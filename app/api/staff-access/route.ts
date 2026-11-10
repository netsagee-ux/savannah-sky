export function POST(){
  return Response.json({error:'Workspace access is restricted to the two academy owners.'},{status:410,headers:{'Cache-Control':'no-store'}});
}
