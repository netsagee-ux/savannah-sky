import Link from 'next/link';
import AcademyShop from '@/components/academy-shop';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {merchantStatus} from '@/lib/sumup';
import {products,postage} from '@/lib/shop';
import './shop.css';
export const dynamic='force-dynamic';
export const metadata={title:'Academy shop'};
export default async function Shop(){
  const [items,shipping,user,merchant]=await Promise.all([products(),postage(),getChatGPTUser(),merchantStatus().catch(()=>null)]);
  return <section className="studio-wrap academy-shop"><header className="shop-intro"><div><span className="studio-kicker">Savannah Sky Training Academy</span><h1>Academy shop</h1>
    <p>{items.length?'Student kits and essentials for your nail practice.':'Student kits and nail supplies are coming to the academy shop.'}</p>
    {items.length?<a className="underlink" href="/shop/orders">My shop orders</a>:<Link className="underlink" href="/courses">Explore the courses</Link>}</div>
    <img src="/salon-colour-swatches-960.webp" srcSet="/salon-colour-swatches-480.webp 480w, /salon-colour-swatches-960.webp 960w" sizes="(max-width:760px) 92vw, 45vw" alt="Warm-toned nail colour swatches on display at Savannah Sky Salon" width={960} height={1023}/></header>
    {items.length?<AcademyShop items={items} shipping={shipping} ready={Boolean(merchant?.code)} signedIn={Boolean(user)}/>:user&&<a className="underlink" href="/shop/orders">My shop orders</a>}</section>;
}
