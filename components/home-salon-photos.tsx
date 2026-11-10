'use client';

import { useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';

export default function HomeSalonPhotos() {
  const strip = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(0);

  function nextPhoto() {
    const el = strip.current;
    if (!el) return;
    const next = el.scrollLeft < el.clientWidth / 2 ? el.clientWidth : 0;
    el.scrollTo({ left: next, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  return <div className="cover-photos">
    <div className="cover-prints" id="cover-prints" ref={strip} onScroll={event => {
      const el = event.currentTarget;
      if (el.clientWidth) setVisible(Math.round(el.scrollLeft / el.clientWidth));
    }}>
      <figure className="cover-photo cover-main">
        <div><img src="/nail-sculpted-960.webp" srcSet="/nail-sculpted-480.webp 480w, /nail-sculpted-960.webp 960w, /nail-sculpted-1440.webp 1440w"
          sizes="(max-width: 660px) 90vw, (max-width: 980px) 47vw, (max-width: 1450px) 29vw, 420px"
          width={960} height={955} fetchPriority="high" alt="Sculpted almond nails with white French tips and hand-painted gold scrollwork" /></div>
        <figcaption>Sculpted French</figcaption>
      </figure>
      <figure className="cover-photo cover-small">
        <div><img src="/salon-fawn-art-480.webp" srcSet="/salon-fawn-art-480.webp 480w, /salon-fawn-art-960.webp 960w"
          sizes="(max-width: 660px) 90vw, (max-width: 980px) 47vw, (max-width: 1300px) 24vw, 310px"
          width={960} height={1280} alt="Carla’s hand-painted fawn and white spots on almond-shaped nails" /></div>
        <figcaption>Hand-painted fawn</figcaption>
      </figure>
    </div>
    <button className="cover-next" type="button" aria-controls="cover-prints" onClick={nextPhoto}>Next photo <ArrowRight size={15} aria-hidden="true" /></button>
    <span className="cover-current sr-only" role="status">{visible ? 'Hand-painted fawn' : 'Sculpted French'}</span>
  </div>;
}
