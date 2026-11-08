'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize2, X } from 'lucide-react';

const looks = [
  { file: 'sculpted', title: 'Sculpted French', alt: 'Ivory French tips finished with fine gold scrollwork' },
  { file: 'floral', title: 'Petal study', alt: 'Hand-sculpted pink petals and gold accents on a nude base' },
  { file: 'leopard', title: 'Leopard tips', alt: 'Leopard-print French tips with dark, fine detailing' },
  { file: 'red', title: 'Red lacquer', alt: 'Red and black nail art with fine metallic lines' },
];

export default function BrandGallery() {
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const look = looks[active];

  function open(index: number) {
    setActive(index);
    dialog.current?.showModal();
  }

  function turn(direction: number) {
    setActive(index => (index + direction + looks.length) % looks.length);
  }

  return (
    <>
      {looks.slice(0, 2).map((sample, index) =>
        <figure className={'sample sample-' + sample.file} key={sample.file}>
          <button className="sample-button" type="button" aria-label={'Open nail gallery: ' + sample.title} aria-haspopup="dialog" onClick={() => open(index)}>
            <span className="sample-frame"><img src={'/nail-' + sample.file + '-480.webp'}
              srcSet={'/nail-' + sample.file + '-480.webp 480w, /nail-' + sample.file + '-960.webp 960w'}
              sizes="(max-width:700px) 43vw, 25vw" width={480} height={600} alt={sample.alt} decoding="async" /></span>
            <span className="sample-caption">{sample.title}<Maximize2 size={13} /></span>
          </button>
        </figure>
      )}
      <dialog ref={dialog} className="portfolio-dialog" aria-labelledby="look-name" onClick={event => {
        if (event.target === dialog.current) dialog.current?.close();
      }} onKeyDown={event => {
        if (event.key === 'ArrowRight') { event.preventDefault(); turn(1); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1); }
      }}>
        <div className="portfolio-sheet">
          <img src={'/nail-' + look.file + '-960.webp'} alt={look.alt} width={960} height={960} />
          <button type="button" className="portfolio-close" aria-label="Close nail gallery" onClick={() => dialog.current?.close()}><X size={19} /></button>
          <div className="portfolio-caption">
            <div aria-live="polite"><small>Savannah Sky Salon</small><h2 id="look-name">{look.title}</h2></div>
            <div className="portfolio-controls"><button aria-label="Previous nail design" onClick={() => turn(-1)}><ArrowLeft size={18} /></button><span>{active + 1} / {looks.length}</span><button aria-label="Next nail design" onClick={() => turn(1)}><ArrowRight size={18} /></button></div>
          </div>
        </div>
      </dialog>
    </>
  );
}
