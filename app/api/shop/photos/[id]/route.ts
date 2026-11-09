import {shopDatabase} from '@/lib/shop-schema';
import {admin} from '@/lib/server';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const row=await (await shopDatabase()).prepare('SELECT photo,mime,published FROM shop_products WHERE id=? AND photo IS NOT NULL').bind(id).first<{photo:Uint8Array;mime:string;published:number}>();
  if(!row||(!row.published&&!await admin()))return new Response(null,{status:404});
  return new Response(new Uint8Array(row.photo),{headers:{'Content-Type':row.mime,'X-Content-Type-Options':'nosniff','Cache-Control':row.published?'public,max-age=300':'private,no-store'}});
}
