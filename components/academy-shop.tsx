'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ShoppingBag, Plus, Minus, ArrowRight} from 'lucide-react';
import {useNavigationAction} from '@/hooks/use-navigation-action';
import {gbp, type BasketLine, type DeliveryMethod, type Product, type ShopQuote, type Variant} from '@/lib/shop-types';

const maxUnits = 20;
const lineId = (line: BasketLine) => line.variantId || line.id;
const variationName = (variant: {colour?: string; size?: string}) => [variant.colour, variant.size].filter(Boolean).join(' / ');
const stockLimit = (variant: Variant) => Math.min(maxUnits, variant.stock ?? maxUnits);

type Props = {items: Product[]; methods: DeliveryMethod[]; ready: boolean; signedIn: boolean};
type ChangeLine = (id: string, variantId: string, amount: number) => void;

function ProductCard({product, basket, disabled, add}: {
  product: Product; basket: BasketLine[]; disabled: boolean; add: ChangeLine;
}) {
  const variants = product.variants.filter(variant => variant.active);
  const [selected, setSelected] = useState('');
  const [units, setUnits] = useState('1');
  const variant = variants.find(v => v.id === selected) || variants.find(v => stockLimit(v) > 0) || variants[0];
  const inBasket = variant ? basket.find(line => lineId(line) === variant.id)?.quantity || 0 : 0;
  const available = variant ? Math.max(0, stockLimit(variant) - inBasket) : 0;
  const quantity = Number(units);
  const canAdd = (inBasket > 0 || basket.length < 30) && available > 0 && Number.isInteger(quantity) && quantity > 0 && quantity <= available;

  function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disabled && canAdd) {
      add(product.id, variant.id, quantity);
      setUnits('1');
    }
  }

  return <article>
    {product.has_photo ? <img loading="lazy" src={'/api/shop/photos/' + product.id + '?v=' + encodeURIComponent(product.updated_at)} alt={product.title} width={480} height={360}/> : null}
    <div className="shop-product-heading"><h2>{product.title}</h2><strong>{gbp(product.price)}</strong></div>
    {product.category && <small>{product.category}</small>}
    <p>{product.description}</p>
    <form className="form shop-product-actions" onSubmit={addProduct}>
      {variant && (variants.length > 1 || variationName(variant)) &&
        <label>Choose an option<select value={variant.id} disabled={disabled} onChange={event => {setSelected(event.target.value); setUnits('1');}}>
          {variants.map(option => <option key={option.id} value={option.id}>{variationName(option) || 'Standard'}{option.stock === 0 ? ' · Sold out' : ''}</option>)}
        </select></label>}
      {variant && variant.stock !== null && variant.stock > 0 && <span className="shop-stock">{variant.stock} in stock</span>}
      {variant && stockLimit(variant) > 0 ? <>
        <label>Quantity<input type="number" inputMode="numeric" min="1" max={available || 1} step="1" required disabled={disabled || !available} value={units} onChange={event => setUnits(event.target.value)}/></label>
        <button type="submit" className="button outline" disabled={disabled || !canAdd}><Plus size={16} aria-hidden="true"/>{!inBasket && basket.length >= 30 ? 'Basket has 30 options' : available ? 'Add to basket' : 'Maximum in basket'}</button>
      </> : <span className="shop-stock">Sold out</span>}
    </form>
  </article>;
}

function readStorage<T>(name: string, fallback: T): T {
  try { return JSON.parse(sessionStorage.getItem(name) || 'null') ?? fallback; }
  catch { return fallback; }
}

export default function AcademyShop({items, methods, ready, signedIn}: Props) {
  const router = useRouter();
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [category, setCategory] = useState('');
  const [methodId, setMethodId] = useState(methods[0]?.id || '');
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [generation, setGeneration] = useState(0);
  const [response, setResponse] = useState<{key: string; quote?: ShopQuote; error?: string} | null>(null);
  const [notice, setNotice] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const {busy, begin, finish} = useNavigationAction();
  const attempt = useRef({payload: '', id: ''});
  const products = new Map(items.map(product => [product.id, product]));
  const variants = new Map(items.flatMap(product => product.variants.filter(v => v.active).map(v => [v.id, v] as const)));
  const categories = new Map(items.filter(p => p.category_id && p.category).map(p => [p.category_id!, p.category!]));
  const method = methods.find(option => option.id === methodId) || methods[0];
  const chosenMethod = method?.id || '';
  const basketJSON = JSON.stringify(basket);

  useEffect(() => {
    const stored = readStorage<unknown>('academy-basket', []);
    if (Array.isArray(stored)) {
      const seen = new Set<string>();
      setBasket(stored.filter(line => {
        if (typeof line?.id !== 'string' || (line.variantId !== undefined && typeof line.variantId !== 'string') ||
          !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > maxUnits || seen.has(lineId(line))) return false;
        seen.add(lineId(line));
        return true;
      }));
    }
    const saved = readStorage<{methodId?: string; code?: string}>('academy-shop-choices', {});
    if (typeof saved.methodId === 'string') setMethodId(saved.methodId);
    if (typeof saved.code === 'string') {setCode(saved.code); setCodeInput(saved.code);}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      try {
        sessionStorage.setItem('academy-basket', basketJSON);
        sessionStorage.setItem('academy-shop-choices', JSON.stringify({methodId: chosenMethod, code}));
      } catch { /* The current tab can still check out without storage. */ }
    }
  }, [hydrated, basketJSON, chosenMethod, code]);

  const quotePayload = JSON.stringify({items: basket, methodId: chosenMethod, discountCode: code});
  const quoteKey = quotePayload + '/' + generation;
  const current = response?.key === quoteKey ? response : null;
  const quote = current?.quote;
  const needsQuote = hydrated && basket.length > 0 && Boolean(chosenMethod);
  useEffect(() => {
    if (!needsQuote) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    let active = true;
    async function updateQuote() {
      try {
        const result = await fetch('/api/shop/quote', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: quotePayload, signal: controller.signal});
        const data = await result.json() as ShopQuote | {error?: string};
        if (!result.ok || !('lines' in data)) throw Error('error' in data && data.error || 'We could not check this basket.');
        if (active) setResponse({key: quoteKey, quote: data});
      } catch (error) {
        if (active) setResponse({key: quoteKey, error: controller.signal.aborted ? 'Checking the basket took too long. Please try again.' : (error as Error).message});
      }
    }
    void updateQuote();
    return () => {active = false; clearTimeout(timeout); controller.abort();};
  }, [needsQuote, quoteKey, quotePayload]);

  function change(id: string, variantId: string, delta: number) {
    setCheckoutError('');
    const variant = variants.get(variantId);
    setBasket(old => {
      const index = old.findIndex(line => lineId(line) === variantId);
      const previous = old[index]?.quantity || 0;
      const quantity = delta > 0 ? Math.max(previous, Math.min(previous + delta, variant ? stockLimit(variant) : 0)) : Math.max(0, previous + delta);
      if (quantity === previous) return old;
      if (!quantity) return old.filter(line => lineId(line) !== variantId);
      const updated = {id, variantId, quantity};
      return index === -1 ? [...old, updated] : old.map((line, i) => i === index ? updated : line);
    });
  }

  function refreshBasket() {
    setCheckoutError('');
    setGeneration(n => n + 1);
    router.refresh();
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote || !begin()) return;
    setCheckoutError('');
    const delivery = Object.fromEntries(new FormData(event.currentTarget));
    const purchase = {items: basket, methodId: chosenMethod, discountCode: code, delivery, total: quote.total};
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(purchase)));
      const fingerprint = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
      let previous = readStorage('academy-shop-attempt', attempt.current);
      if (previous.payload !== fingerprint) previous = {payload: fingerprint, id: crypto.randomUUID()};
      attempt.current = previous;
      try {
        sessionStorage.setItem('academy-shop-attempt', JSON.stringify({...previous, basket: basketJSON}));
      } catch { /* The in-memory attempt also handles a retry. */ }
      const result = await fetch('/api/shop/checkout', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(45000),
        body: JSON.stringify({...purchase, attempt: previous.id}),
      });
      const data = await result.json() as {path?: string; error?: string};
      if (!result.ok || !data.path) {
        if (result.status === 409) refreshBasket();
        throw Error(data.error || 'Unable to open checkout. Please try again.');
      }
      location.assign(data.path);
    } catch (error) {
      setCheckoutError((error as Error).message || 'Unable to open checkout. Please try again.');
      finish();
    }
  }

  const quantity = basket.reduce((sum, line) => sum + line.quantity, 0);
  const pendingCode = codeInput.trim().toUpperCase() !== code;

  if (!items.length && !basket.length) return null;
  return <div className="shop-layout">
    <section aria-label="Products">
      {quantity > 0 && <a className="underlink shop-jump" href="#basket">View basket ({quantity})</a>}
      {categories.size > 0 && <div className="form shop-filter"><label>Category<select value={category} onChange={event => setCategory(event.target.value)}>
        <option value="">All products</option>
        {[...categories].sort((a,b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label></div>}
      <div className="shop-products">{items.filter(p => !category || p.category_id === category).map(product =>
        <ProductCard key={product.id} product={product} basket={basket} disabled={!hydrated || busy} add={(id, variantId, amount) => {
          change(id, variantId, amount); setNotice(amount + ' × ' + product.title + ' added to your basket.');
        }}/>)}</div>
      <p role="status">{notice} {notice && <a className="underlink" href="#basket">View basket</a>}</p>
    </section>
    <aside className="shop-basket" id="basket" aria-label="Your basket">
      <div className="shop-basket-heading"><h2><ShoppingBag size={22} aria-hidden="true"/> Your basket</h2>{quantity > 0 && <span>{quantity} {quantity === 1 ? 'item' : 'items'}</span>}</div>
      {basket.length ? <>
        <ul>{basket.map(line => {
          const id = lineId(line), product = products.get(line.id), variant = variants.get(id);
          const confirmed = quote?.lines.find(item => lineId(item) === id);
          const title = confirmed?.title || product?.title || 'Unavailable item';
          const available = variant && variant.product_id === line.id;
          const variantLabel = variationName(confirmed || variant || {});
          const price = confirmed?.price ?? product?.price;
          return <li key={id}>
            <strong>{title}</strong>
            {variantLabel && <span className="shop-variation">{variantLabel}</span>}
            {!confirmed && (!available ? <span className="shop-stock">This item is no longer available. Remove it to continue.</span> :
              variant.stock !== null && line.quantity > variant.stock && <span className="shop-stock">{variant.stock ? 'Only ' + variant.stock + ' available. Reduce the quantity to continue.' : 'This option is sold out.'}</span>)}
            <div className="shop-quantity">
              <button type="button" disabled={busy} aria-label={'Remove one ' + title + ' ' + variantLabel} onClick={() => change(line.id, id, -1)}><Minus size={15}/></button>
              <output aria-label="Quantity">{line.quantity}</output>
              <button type="button" disabled={busy || !available || line.quantity >= stockLimit(variant)} aria-label={'Add one ' + title + ' ' + variantLabel} onClick={() => change(line.id, id, 1)}><Plus size={15}/></button>
              {price !== undefined && <span className="shop-line-total">{gbp(price * line.quantity)}</span>}
            </div>
            <button className="underlink" type="button" disabled={busy} aria-label={'Remove ' + title + ' ' + variantLabel + ' from basket'} onClick={() => change(line.id, id, -line.quantity)}>Remove</button>
          </li>;
        })}</ul>
        {methods.length ? <>
          <div className="form">
            <label>Delivery or collection<select value={chosenMethod} disabled={busy} onChange={event => {setMethodId(event.target.value); setCheckoutError('');}}>
              {methods.map(option => <option key={option.id} value={option.id}>{option.name} · {option.price ? gbp(option.price) : 'Free'}</option>)}
            </select></label>
          </div>
          <form className="form" onSubmit={event => {event.preventDefault(); setCode(codeInput.trim().toUpperCase()); setCheckoutError('');}}>
            <div className="shop-code-row"><label>Discount code<input value={codeInput} maxLength={64} disabled={busy} autoCapitalize="characters" onChange={event => setCodeInput(event.target.value)}/></label>
              <button className="button outline" type="submit" disabled={busy || !pendingCode}>Apply</button></div>
            {code && <button className="underlink" type="button" disabled={busy} onClick={() => {setCode(''); setCodeInput(''); setCheckoutError('');}}>Remove code</button>}
          </form>
          {quote && <dl className="shop-amounts">
            <div><dt>Subtotal</dt><dd>{gbp(quote.subtotal)}</dd></div>
            {quote.discount > 0 && <div><dt>Discount ({quote.discountCode})</dt><dd>−{gbp(quote.discount)}</dd></div>}
            <div><dt>{quote.method.name}</dt><dd>{quote.shipping ? gbp(quote.shipping) : 'Free'}</dd></div>
            <div className="shop-grand-total"><dt>Total</dt><dd>{gbp(quote.total)}</dd></div>
          </dl>}
          {current?.error ? <div role="alert"><p>{current.error}</p><button type="button" className="underlink" onClick={refreshBasket}>Refresh basket</button></div> :
            needsQuote && !quote && <p role="status">Checking stock and totals…</p>}
          {ready || quote?.total === 0 ? signedIn ? <form className="form" onSubmit={pay}>
            <h3>{method?.kind === 'collection' ? 'Collection details' : 'UK delivery address'}</h3>
            <label>Full name<input name="name" readOnly={busy} autoComplete="name" maxLength={150} required/></label>
            {method?.kind !== 'collection' && ([['street','Address line 1','address-line1'],['line2','Address line 2 (optional)','address-line2'],['town','Town or city','address-level2'],['postcode','Postcode','postal-code']] as const).map(([name,label,autocomplete]) =>
              <label key={name}>{label}<input name={name} readOnly={busy} autoComplete={autocomplete} maxLength={name === 'postcode' ? 10 : 150} required={name !== 'line2'}/></label>)}
            {pendingCode && <p>Apply or clear the code before continuing.</p>}
            <button className="button" aria-busy={busy} disabled={busy || !quote || pendingCode}>{busy ? 'Opening your order…' : quote?.total === 0 ? 'Place order' : 'Continue to payment'} <ArrowRight size={16}/></button>
          </form> : <a className="button" href="/sign-in?redirect_url=%2Fshop%23basket">Sign in to check out</a> :
            <p>Checkout will open once the academy connects its payment account.</p>}
        </> : <p>Checkout will open when the academy adds a delivery or collection option.</p>}
        {checkoutError && <p role="alert">{checkoutError}</p>}
      </> : <p>{hydrated ? 'Your basket is empty.' : 'Loading your basket…'}</p>}
    </aside>
  </div>;
}
