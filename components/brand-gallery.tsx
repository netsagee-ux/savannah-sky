'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize2, X } from 'lucide-react';

const looks = [
  { file: 'sculpted', title: 'Sculpted French', alt: 'White French tips with gold scrollwork over a sheer nude base', position: '50% 50%' },
  { file: 'floral', title: 'Petal study', alt: 'Pink petals and gold details on a translucent floral set', position: '50% 52%' },
  { file: 'leopard', title: 'Leopard tips', alt: 'Hand-painted leopard spots on nude almond nails', position: '50% 57%' },
  { file: 'red', title: 'Red lacquer', alt: 'Glossy red and black nails with metallic lines', position: '50% 54%' },
];

export default function BrandGallery() {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const look = looks[active];
  const turn = (by: number) => setActive(i => (i + by + looks.length) % looks.length);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setInterval> | undefined;
    function schedule() {
      clearInterval(timer);
      if (!held && !focused && !expanded && !preference.matches && !document.hidden) {
        timer = setInterval(() => setActive(i => (i + 1) % looks.length), 7000);
      }
    }
    schedule();
    preference.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearInterval(timer);
      preference.removeEventListener('change', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [held, focused, expanded]);

  return <div className="hero-gallery" aria-label="Salon nail portfolio" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="hero-plates">{looks.map((sample,i) => <img key={sample.file} className={active === i ? 'current' : ''}
      src={'/nail-' + sample.file + '-960.webp'} srcSet={[480,960,1440].map(w => '/nail-' + sample.file + '-' + w + '.webp ' + w + 'w').join(', ')}
      sizes="(max-width: 750px) 100vw, 59vw" alt={active === i ? sample.alt : ''} aria-hidden={active !== i}
      style={{objectPosition:sample.position}} width={960} height={1080} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'low'} />)}</div>
    <button type="button" className="gallery-expand" aria-haspopup="dialog" aria-label={'Enlarge ' + look.title} onClick={() => {dialog.current?.showModal();setExpanded(true);}}><Maximize2 size={18}/></button>
    <div className="plate-footer"><h2>{look.title}</h2><div className="plate-controls">
      <button type="button" onClick={() => turn(-1)} aria-label="Previous nail set"><ArrowLeft size={19}/></button>
      <button type="button" onClick={() => turn(1)} aria-label="Next nail set"><ArrowRight size={19}/></button>
    </div></div>
    <dialog ref={dialog} className="portfolio-dialog" aria-labelledby="look-name" onClose={() => setExpanded(false)}
      onClick={event => {if (event.target === event.currentTarget) dialog.current?.close();}}
      onKeyDown={event => {if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault();turn(event.key === 'ArrowRight' ? 1 : -1);}}}>
      <div className="portfolio-sheet"><img src={'/nail-' + look.file + '-1440.webp'} alt={look.alt} width={960} height={1080}/>
        <button type="button" className="portfolio-close" aria-label="Close nail gallery" onClick={() => dialog.current?.close()}><X size={18}/></button>
        <div className="portfolio-caption"><h2 id="look-name" aria-live="polite">{look.title}</h2><div className="portfolio-controls">
          <button type="button" aria-label="Previous nail design" onClick={() => turn(-1)}><ArrowLeft size={18}/></button>
          <button type="button" aria-label="Next nail design" onClick={() => turn(1)}><ArrowRight size={18}/></button>
        </div></div>
      </div>
    </dialog>
  </div>;
}
