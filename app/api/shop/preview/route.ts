import {sameSiteOrigin} from '@/lib/request-origin';
import {admin} from '@/lib/server';
import {quoteBasket} from '@/lib/shop';
import {SumUpError} from '@/lib/sumup';

export async function POST(request:Request) {
  if (!sameSiteOrigin(request) || !await admin()) return Response.json({error:'Staff access required.'},{status:403});
  try {
    return Response.json(await quoteBasket(await request.json(),true),{headers:{'Cache-Control':'private, no-store'}});
  } catch (error) {
    const expected = error instanceof SumUpError && [400,409].includes(error.status);
    return Response.json({error:expected ? error.message : 'The preview basket could not be priced.'},{status:expected ? error.status : 503});
  }
}
