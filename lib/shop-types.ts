export type Product={id:string;title:string;description:string;price:number;published:number;has_photo:number;updated_at:string};
export type BasketLine={id:string;quantity:number};
export type OrderLine=BasketLine&{title:string;price:number};
export type Delivery={name:string;street:string;line2:string;town:string;postcode:string};
export type ShopOrder={id:string;user_id:string;email:string;items:string;shipping:number;amount:number;delivery:string;
  fingerprint:string;merchant:string;session_id:string|null;status:string;created_at:string;paid_at:string|null;dispatched_at:string|null;tracking:string|null};
export const gbp=(pence:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(pence/100);
