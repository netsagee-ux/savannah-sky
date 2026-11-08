'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react';

export type Review = { id: string; name: string; text: string; source?: string | null };

function excerpt(text: string) {
  const limit = 155;
  if (text.length <= limit) return text;

  // This pull quote comes verbatim from the published opening review.
  const pullQuote = 'Savannah Sky has become my safe space, where I feel supported and able to be myself.';
  if (text.includes(pullQuote)) return pullQuote;

  const lead = text.slice(0, limit);
  const sentence = lead.match(/^.*[.!?](?=\s|$)/u);
  if (sentence) return sentence[0];
  const boundary = lead.lastIndexOf(' ');
  return lead.slice(0, boundary > 0 ? boundary : limit).trimEnd() + '…';
}

export default function StudioReview({ reviews }: { reviews: Review[] }) {
  const [index, setIndex] = useState(0);
  const review = reviews[index];
  const text = review.text.trim();
  const quote = excerpt(text);

  return (
    <div className="review-reading">
      <div key={review.id} aria-live="polite" aria-atomic="true">
        <figure className="review-quote">
          <blockquote>“{quote}”</blockquote>
          <figcaption>{review.name}</figcaption>
        </figure>
        {quote !== text && (
          <details className="review-disclosure">
            <summary><span className="review-open-label">Read full review</span><span className="review-close-label">Show less</span><ChevronDown size={16} aria-hidden="true" /></summary>
            <div className="review-prose">{text.split(/\n+/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
          </details>
        )}
        {review.source && <a className="review-source" href={review.source} target="_blank" rel="noopener noreferrer">View original <ArrowUpRight size={14} aria-hidden="true" /></a>}
      </div>
      {reviews.length > 1 && (
        <nav className="review-pager" aria-label="Browse reviews">
          <button type="button" aria-label="Previous review" onClick={() => setIndex((index + reviews.length - 1) % reviews.length)}><ArrowLeft size={16} /></button>
          <span aria-label={'Review ' + (index + 1) + ' of ' + reviews.length}>{index + 1} / {reviews.length}</span>
          <button type="button" aria-label="Next review" onClick={() => setIndex((index + 1) % reviews.length)}><ArrowRight size={16} /></button>
        </nav>
      )}
    </div>
  );
}
