'use client';

import {useState} from 'react';
import {ArrowLeft, ArrowRight} from 'lucide-react';

const looks = [
  {file:'nail-sculpted', title:'Sculpted French', alt:'White almond tips with raised gold scrollwork on a blush base', large:1440},
  {file:'nail-red', title:'Red lacquer', alt:'Glossy red and black nail art edged in metallic silver', large:1440},
  {file:'nail-botanical', title:'Botanical ink', alt:'Fine black botanical detailing on a natural manicure', large:1368},
];

export default function HomeSalonPhotos() {
  const [index, setIndex] = useState(0);
  const look = looks[index];
  const move = (step:number) => setIndex(current => (current + step + looks.length) % looks.length);
  return <figure className="campaign-look" aria-label="Salon portfolio">
    <img key={look.file} src={'/'+look.file+'-960.webp'}
      srcSet={'/'+look.file+'-480.webp 480w, /'+look.file+'-960.webp 960w, /'+look.file+'-'+look.large+'.webp '+look.large+'w'}
      sizes="(max-width: 700px) 100vw, 53vw" width={960} height={955} fetchPriority={index===0?'high':'auto'} alt={look.alt}/>
    <figcaption>
      <div className="look-name" aria-live="polite" aria-atomic="true"><small>From the salon portfolio</small><strong>{look.title}</strong></div>
      <div className="look-buttons">
        <button type="button" aria-label="Previous salon photo" onClick={()=>move(-1)}><ArrowLeft size={18}/></button>
        <button type="button" aria-label="Next salon photo" onClick={()=>move(1)}><ArrowRight size={18}/></button>
      </div>
    </figcaption>
  </figure>;
}
