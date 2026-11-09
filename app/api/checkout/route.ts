import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,enrolled} from '@/lib/server';
import {hasCourseDelivery,hasCoursePrice} from '@/lib/payments';
import {startSumUp,SumUpError} from '@/lib/sumup';

export async function POST(request:Request){
  const origin=new URL(request.url).origin;
  if(request.headers.get('origin')!==origin)return Response.json({error:'Invalid origin.'},{status:403});
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in to buy this course.'},{status:401});
  try {
    const data=await request.json().catch(()=>null) as Record<string,unknown>|null;
    if(!data || typeof data.courseId!=='string' || data.handoff || data.test || data.orderId)return Response.json({error:'Start a new payment on the course page.'},{status:409});
    const course=await db().prepare('SELECT id,title,price FROM courses WHERE id=? AND published=1').bind(data.courseId).first<{id:string;title:string;price:number}>();
    if(!course)return Response.json({error:'Course unavailable.'},{status:409});
    if(await enrolled(course.id))return Response.json({path:'/dashboard'});
    if(!hasCoursePrice(course.price)||!await hasCourseDelivery(course))return Response.json({error:'Online enrolment is not open for this course.'},{status:409});
    return Response.json({path:await startSumUp(user,course,origin)},{headers:{'Cache-Control':'no-store'}});
  } catch(e){
    if(e instanceof SumUpError && e.status===409)return Response.json({error:e.message},{status:409});
    return Response.json({error:'Checkout is temporarily unavailable. Please try again later.'},{status:503});
  }
}
