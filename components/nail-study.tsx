'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Maximize2, X } from 'lucide-react';

const looks = [
  { file: 'floral', id: '1651757663623334', largest: 1440, name: 'Petal study', detail: 'Pink petals and gold details on a translucent floral set.' },
  { file: 'red', id: '1681388600660240', largest: 1440, name: 'Red lacquer', detail: 'Glossy red and black nails divided by fine metallic lines.' },
  { file: 'botanical', id: '1570313095101125', largest: 1368, name: 'Botanical ink', detail: 'Leaf outlines, leopard spots and gold tips on a sheer base.' },
  { file: 'sculpted', id: '1652682400197527', largest: 1440, name: 'Sculpted French', detail: 'White almond tips with raised gold scrollwork over a nude base.' },
];

export default function NailStudy() {
  const [active, setActive] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const look = active === null ? null : looks[active];

  function move(offset: number) {
    setActive(i => ((i ?? 0) + offset + looks.length) % looks.length);
  }

  return <section className="work-wall folio-section" id="salon-work" aria-labelledby="portfolio-title">
    <div className="folio-wrap">
      <div className="folio-heading"><div><span className="folio-label">The salon portfolio</span>
        <h2 id="portfolio-title">A closer <em>look.</em></h2></div>
        <a className="folio-link" href="https://www.facebook.com/Savannahskyaromas/photos">The salon album <ArrowUpRight size={16} aria-hidden="true" /></a></div>
      <div className="work-prints">{looks.map((item, i) =>
        <button className="work-print" key={item.file} type="button" aria-label={'Enlarge ' + item.name} aria-haspopup="dialog"
          onClick={() => { setActive(i); dialog.current?.showModal(); }}>
          <span className="print-image" data-look={'nail-' + item.file}><img src={'/nail-' + item.file + '-480.webp'} srcSet={'/nail-' + item.file + '-480.webp 480w, /nail-' + item.file + '-960.webp 960w'} sizes="(max-width: 479px) 78vw, (max-width: 980px) 44vw, (max-width: 1580px) 21vw, 330px" loading="lazy" width={480} height={560} alt={item.detail} /></span>
          <span className="print-caption">{item.name}<Maximize2 size={15} aria-hidden="true" /></span>
        </button>
      )}</div>
    </div>
    <dialog className="print-dialog" ref={dialog} aria-labelledby="look-name" onClose={() => setActive(null)}
      onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}
      onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } }}>
      <button className="print-close" type="button" aria-label="Close nail gallery" onClick={() => dialog.current?.close()}><X size={19} /></button>
      {look && <div className="print-sheet">
        <img className="print-full" src={'/nail-' + look.file + '-' + look.largest + '.webp'} alt={look.detail} width={960} height={1080} />
        <div className="print-info"><div aria-live="polite"><h3 id="look-name">{look.name}</h3><a className="folio-link" href={'https://www.facebook.com/photo.php?fbid=' + look.id}>Original photo <ArrowUpRight size={14} aria-hidden="true" /></a></div>
          <div className="print-pager"><button type="button" aria-label="Previous nail design" onClick={() => move(-1)}><ArrowLeft size={18} /></button>
          <button type="button" aria-label="Next nail design" onClick={() => move(1)}><ArrowRight size={18} /></button></div>
        </div>
      </div>}
    </dialog>
  </section>;
}
