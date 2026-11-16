export type Variant = {
  id: string; product_id: string; colour: string; size: string; stock: number | null; active: number;
};
export type Product = {
  id: string; title: string; description: string; price: number; published: number; has_photo: number;
  updated_at: string; category_id: string | null; category: string | null; variants: Variant[];
};
export type BasketLine = {id: string; variantId?: string; quantity: number};
export type OrderLine = BasketLine & {title: string; price: number; colour?: string; size?: string};
export type Delivery = {name: string; street: string; line2: string; town: string; postcode: string};
export type DeliveryMethod = {id: string; name: string; kind: 'delivery' | 'collection'; price: number; active: number};
export type ShopQuote = {
  lines: OrderLine[]; subtotal: number; shipping: number; discount: number; total: number;
  method: DeliveryMethod; discountCode: string;
};
export type ShopOrder = {
  id: string; user_id: string; email: string; items: string; shipping: number; amount: number; delivery: string;
  fingerprint: string; merchant: string; session_id: string | null; status: string; created_at: string;
  paid_at: string | null; dispatched_at: string | null; tracking: string | null; method_name: string | null;
  method_kind: DeliveryMethod['kind'] | null; discount_code: string | null; discount_amount: number | null;
};
export const gbp = (pence: number) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(pence / 100);
