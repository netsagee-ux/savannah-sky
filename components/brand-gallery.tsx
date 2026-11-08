'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const looks = [
  { file: 'sculpted', title: 'Sculpted French', alt: 'Ivory French tips finished with fine gold scrollwork' },
  { file: 'floral', title: 'Petal study', alt: 'Pink sculpted petals and gold accents on a soft nude base' },
  { file: 'leopard', title: 'Leopard tips', alt: 'Leopard-print French tips with dark, fine detailing' },
  { file: 'red', title: 'Red lacquer', alt: 'Red and black nail art with delicate metallic lines' },
];

export default function BrandGallery() {
  const [index, setIndex] = useState(0);
  const look = looks[index];
  const source = '/nail-' + look.file;
  const turn = (direction: number) => setIndex(current => (current + direction + looks.length) % looks.length);

  return (
    <figure className="lookbook" aria-label="Savannah Sky nail portfolio">
      <Dialog>
        <DialogTrigger asChild>
          <button className="lookbook-image" aria-label={'Enlarge ' + look.title}>
            <img key={look.file} src={source + '-960.webp'}
              srcSet={source + '-480.webp 480w, ' + source + '-960.webp 960w, ' + source + '-1440.webp 1440w'}
              sizes="(max-width: 720px) 100vw, 52vw"
              width={960} height={960} fetchPriority={index === 0 ? 'high' : 'auto'} alt={look.alt} />
            <span className="enlarge"><Maximize2 size={15} /></span>
          </button>
        </DialogTrigger>
        <DialogContent className="photo-dialog">
          <DialogTitle>{look.title}</DialogTitle>
          <DialogDescription>Original nail work by Savannah Sky.</DialogDescription>
          <img src={source + '-1440.webp'} alt={look.alt} />
        </DialogContent>
      </Dialog>
      <figcaption className="lookbook-bar">
        <div aria-live="polite"><small>From the salon</small><span>{look.title}</span></div>
        <div className="lookbook-controls">
          <button type="button" aria-label="Previous nail design" onClick={() => turn(-1)}><ArrowLeft size={17} /></button>
          <span aria-hidden="true">{index + 1} / {looks.length}</span>
          <button type="button" aria-label="Next nail design" onClick={() => turn(1)}><ArrowRight size={17} /></button>
        </div>
      </figcaption>
    </figure>
  );
}
