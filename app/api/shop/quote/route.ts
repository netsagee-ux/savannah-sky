import {sameSiteOrigin} from '@/lib/request-origin';
import {quoteBasket} from '@/lib/shop';
import {SumUpError} from '@/lib/sumup';

export async function POST(req:Request){
  if(!sameSiteOrigin(req))return Response.json({error:'Invalid origin.'},{status:403});
  try{
    const mode=new URL(req.url).searchParams.get('sample')==='1'?'sample':'sale';
    return Response.json(await quoteBasket(await req.json(),mode),{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    const safe=e instanceof SumUpError&&[400,409].includes(e.status);
    return Response.json({error:safe?e.message:'The basket could not be priced. Please try again.'},{status:safe?e.status:503});
  }
}
