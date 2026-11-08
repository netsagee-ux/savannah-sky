'use client';

import { useState } from 'react';

const studies = [
  { file: 'red', name: 'Lacquer', title: 'Colour & contrast', detail: 'A sweep of glossy red against black makes the fine metallic lines stand out.', alt: 'Scarlet and black nails with sweeping metallic accents', colour: '#903536' },
  { file: 'leopard', name: 'Leopard', title: 'Pattern & placement', detail: 'Small clusters of irregular spots keep the detail at the tips and leave the nude base visible.', alt: 'Leopard spots concentrated at the tips of a nude set', colour: '#92765d' },
  { file: 'floral', name: 'Petal', title: 'Shape & texture', detail: 'Raised pink petals catch the light, with small gold accents between the flowers.', alt: 'A close view of pink floral nail art finished with gold', colour: '#bd9099' },
];

export default function NailStudy() {
  const [index, setIndex] = useState(0);
  const study = studies[index];
  return <section className="study-section" aria-labelledby="study-title"><div className="studio-wrap study-grid">
    <div className="study-visual"><img key={study.file} src={'/nail-' + study.file + '-960.webp'}
      srcSet={'/nail-' + study.file + '-480.webp 480w, /nail-' + study.file + '-960.webp 960w'}
      sizes="(max-width: 750px) 90vw, 51vw" alt={study.alt} width={960} height={1100} loading="lazy" /></div>
    <div className="study-copy"><span className="studio-kicker">Work from the salon</span><h2 id="study-title">A study in <em>detail.</em></h2>
      <div className="study-choices" role="group" aria-label="Choose a nail set">
        {studies.map((look, i) => <button type="button" key={look.file} aria-pressed={index === i} onClick={() => setIndex(i)}>
          <span style={{ backgroundColor: look.colour }} />{look.name}</button>)}
      </div>
      <div aria-live="polite" className="study-caption"><h3>{study.title}</h3><p>{study.detail}</p></div>
    </div>
  </div></section>;
}
