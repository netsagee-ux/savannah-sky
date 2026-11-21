import {sameSiteOrigin} from '@/lib/request-origin';
import {isConversion} from '@/lib/data';
import {qualification} from '@/lib/qualifications';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,enrolled} from '@/lib/server';
import {hasCoursePrice} from '@/lib/payments';
import {startSumUp,SumUpError} from '@/lib/sumup';
import {parseSchedule,upcomingDates,courseDateLabel} from '@/lib/course-schedule';

export async function POST(request:Request){
  if(!sameSiteOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});
  const origin=request.headers.get('origin')!;
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Sign in to buy this course.'},{status:401});
  try {
    const data=await request.json().catch(()=>null) as Record<string,unknown>|null;
    if(!data || typeof data.courseId!=='string' || data.handoff || data.test || data.orderId)return Response.json({error:'Start a new payment on the course page.'},{status:409});
    const course=await db().prepare("SELECT id,title,price,level,(SELECT value FROM settings WHERE id='course-format:'||courses.id) AS format FROM courses WHERE id=? AND published=1").bind(data.courseId).first<{id:string;title:string;price:number;level:string;format:string|null}>();
    if(!course)return Response.json({error:'Course unavailable.'},{status:409});
    if(await enrolled(course.id))return Response.json({path:'/dashboard'});
    if(isConversion(course)&&(await qualification(course.id,user.userId))?.status!=='approved')return Response.json({error:'The academy must approve your nail qualification before payment.'},{status:409});
    if(course.format==='online'||!hasCoursePrice(course.price))return Response.json({error:'This course is not available to book.'},{status:409});
    if(data.provider!==undefined && data.provider!=='sumup' && data.provider!=='paypal')return Response.json({error:'Choose an available payment method.'},{status:400});
    const raw=(await db().prepare('SELECT value FROM settings WHERE id=?').bind('course-schedule:'+course.id).first<{value:string}>())?.value||'';
    const schedule=parseSchedule(raw);
    const selected=upcomingDates(schedule).find(row=>row.id===data.dateId&&row.status==='available');
    if((schedule.dates.length&&!selected)||(!schedule.dates.length&&data.dateId))return Response.json({error:'Choose an available course date. Refresh the course page for the latest dates.'},{status:409});
    const selection={id:selected?.id||'',label:selected?courseDateLabel(selected):'Date to be arranged with Carla',schedule:raw};
    return Response.json({path:await startSumUp(user,course,origin,data.provider==='paypal'?'paypal':'sumup',selection)},{headers:{'Cache-Control':'no-store'}});
  } catch(e){
    if(e instanceof SumUpError && e.status===409)return Response.json({error:e.message},{status:409});
    return Response.json({error:'Checkout is temporarily unavailable. Please try again later.'},{status:503});
  }
}
