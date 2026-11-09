import {getChatGPTUser} from '@/app/chatgpt-auth';
import {startShopOrder} from '@/lib/shop';
import {SumUpError} from '@/lib/sumup';
export async function POST(req:Request){
  const origin=new URL(req.url).origin;
  if(req.headers.get('origin')!==origin)return Response.json({error:'Invalid origin.'},{status:403});
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to check out.'},{status:401});
  try{return Response.json({path:await startShopOrder(user,await req.json() as Parameters<typeof startShopOrder>[1],origin)},{headers:{'Cache-Control':'no-store'}});}
  catch(e){const safe=e instanceof SumUpError&&[400,409].includes(e.status);
    return Response.json({error:safe?e.message:'Checkout is temporarily unavailable. You can retry with the same basket.'},{status:safe?e.status:503});}
}
