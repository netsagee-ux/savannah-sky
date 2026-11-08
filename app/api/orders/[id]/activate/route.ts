import {getChatGPTUser} from '@/app/chatgpt-auth';
import {claimPaidOrders,ownedOrder} from '@/lib/course-orders';
import {paidInvitationPath} from '@/lib/course-invitation';
import {enrolled} from '@/lib/server';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  if(request.headers.get('origin')!==new URL(request.url).origin) return Response.json({error:'Invalid origin.'},{status:403});
  const user=await getChatGPTUser();
  if(!user) return Response.json({error:'Sign in with your order email.'},{status:401});
  const {id}=await params;
  try {
    const body=await request.json() as {password?:unknown} | null;
    if(typeof body?.password!=='string'||body.password.length>32) return Response.json({error:'Enter your course password.'},{status:400});
    await claimPaidOrders(user,id,body.password);
    const order=await ownedOrder(id,user.userId);
    if(order?.status!=='paid'||!await enrolled(order.course_id)) return Response.json({error:'Check the password and your order email.'},{status:403});
    const path=await paidInvitationPath(id);
    if(!path)return Response.json({error:'Course access is inactive.'},{status:403});
    return Response.json({ok:true,path},{headers:{'Cache-Control':'private, no-store'}});
  } catch {return Response.json({error:'Activation could not be checked. Please try again.'},{status:503});}
}
