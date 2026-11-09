'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize2, X } from 'lucide-react';

const looks = [
  { file: 'sculpted', facebookId: '1652682400197527', largest: 1440, name: 'Sculpted French', colour: '#e5c9b4', position: '50% 25%', alt: 'White French tips with gold scrollwork over a sheer nude base',
    detail: 'A crisp white tip frames each almond shape. Raised gold scrollwork follows the curve of the nail.' },
  { file: 'floral', facebookId: '1651757663623334', largest: 1440, name: 'Petal study', colour: '#ca8d9a', position: '50% 32%', alt: 'Pink petals and gold details on a translucent floral set',
    detail: 'Soft pink petals sit above a translucent base. Small gold accents catch the light between the flowers.' },
  { file: 'botanical', facebookId: '1570313095101125', largest: 1368, name: 'Botanical ink', colour: '#8f775f', position: '50% 50%', alt: 'Black leaf outlines, leopard spots and gold tips on a nude manicure',
    detail: 'Black leaves and tiny leopard spots sit on a sheer base. Metallic gold follows the tips.' },
  { file: 'red', facebookId: '1681388600660240', largest: 1440, name: 'Red lacquer', colour: '#872c34', position: '50% 40%', alt: 'Glossy red and black nails with metallic lines',
    detail: 'Glossy red and black meet on a diagonal. A fine metallic line picks out the edge between the colours.' },
];

export default function NailStudy() {
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const look = looks[active];
  const move = (direction: number) => setActive(i => (i + direction + looks.length) % looks.length);

  return (
    <section className="study-section" id="salon-work" aria-labelledby="study-title">
      <div className="studio-wrap study-grid">
        <div className="study-visual">
          <img key={look.file} src={'/nail-' + look.file + '-960.webp'}
            srcSet={'/nail-' + look.file + '-480.webp 480w, /nail-' + look.file + '-960.webp 960w, /nail-' + look.file + '-' + look.largest + '.webp ' + look.largest + 'w'}
            sizes="(max-width: 750px) 92vw, 49vw" style={{ objectPosition: look.position }}
            alt={look.alt} width={960} height={1080} loading="lazy" />
          <button type="button" className="gallery-expand" aria-haspopup="dialog" aria-label={'Enlarge ' + look.name}
            onClick={() => dialog.current?.showModal()}><Maximize2 size={18} /></button>
        </div>
        <div className="study-copy">
          <span className="studio-kicker">Carla’s salon portfolio</span>
          <h2 id="study-title">Behind <em>the set.</em></h2>
          <div className="study-choices" role="group" aria-label="Choose a nail set">
            {looks.map((sample, i) => (
              <button type="button" key={sample.file} aria-pressed={active === i} aria-label={'Show ' + sample.name}
                title={sample.name} onClick={() => setActive(i)}>
                <span style={{ backgroundColor: sample.colour }} />
              </button>
            ))}
          </div>
          <div aria-live="polite" className="study-caption"><h3>{look.name}</h3><p>{look.detail}</p><a className="studio-text-link" href={'https://www.facebook.com/photo.php?fbid='+look.facebookId}>See this set on Facebook <ArrowRight size={16} aria-hidden="true"/></a></div>
        </div>
      </div>
      <dialog ref={dialog} className="portfolio-dialog" aria-labelledby="look-name"
        onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowRight' ? 1 : -1);
          }
        }}>
        <div className="portfolio-sheet">
          <img src={'/nail-' + look.file + '-' + look.largest + '.webp'} alt={look.alt} width={960} height={1080} loading="lazy" />
          <button type="button" className="portfolio-close" aria-label="Close nail gallery" onClick={() => dialog.current?.close()}><X size={18} /></button>
          <div className="portfolio-caption"><h2 id="look-name" aria-live="polite">{look.name}</h2>
            <div className="portfolio-controls">
              <button type="button" aria-label="Previous nail design" onClick={() => move(-1)}><ArrowLeft size={18} /></button>
              <button type="button" aria-label="Next nail design" onClick={() => move(1)}><ArrowRight size={18} /></button>
            </div>
          </div>
        </div>
      </dialog>
    </section>
  );
}
