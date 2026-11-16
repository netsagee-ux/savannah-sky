import Link from 'next/link';
import {notFound} from 'next/navigation';
import {admin} from '@/lib/server';
import AcademyShop from '@/components/academy-shop';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {merchantStatus} from '@/lib/sumup';
import {products,deliveryMethods} from '@/lib/shop';
import './shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Academy shop'};
export default async function Shop({searchParams}:{searchParams:Promise<{preview?:string}>}){
  const preview=(await searchParams).preview==='1';
  if(preview&&!await admin())notFound();
  const [items,methods,user,merchant]=await Promise.all([products(preview,!preview),deliveryMethods(preview),getChatGPTUser(),merchantStatus().catch(()=>null)]);
  return <section className="studio-wrap academy-shop"><header className="shop-intro"><div><span className="studio-kicker">Savannah Sky Training Academy</span><h1>{preview?'Shop preview':'Academy shop'}</h1>
    <p>{preview?'For staff. Try products, stock levels and basket totals here. Hidden products, inactive discounts and delivery options are included.':items.length?'Student kits and essentials for your nail practice.':'Student kits and nail supplies are coming to the academy shop.'}</p>
    {preview?<a className="underlink" href="/admin?tab=Shop">Back to shop management</a>:items.length?<a className="underlink" href="/shop/orders">My shop orders</a>:<Link className="underlink" href="/courses">Explore the courses</Link>}</div>
    <img src="/salon-colour-swatches-960.webp" srcSet="/salon-colour-swatches-480.webp 480w, /salon-colour-swatches-960.webp 960w" sizes="(max-width:760px) 92vw, 45vw" alt="Warm-toned nail colour swatches on display at Savannah Sky Salon" width={960} height={1023}/></header>
    {!items.length && user && <a className="underlink" href="/shop/orders">My shop orders</a>}
    <AcademyShop key={preview?'preview':'shop'} preview={preview} items={items} methods={methods} ready={Boolean(merchant?.code)} signedIn={Boolean(user)}/></section>;
}
