import { db } from '@/lib/server';
import StudioReview, { type Review } from './studio-review';

export default async function Reviews() {
  let reviews: Review[];
  try {
    const row = await db().prepare('SELECT value FROM settings WHERE id=?')
      .bind('client_reviews').first<{ value: string }>();
    const saved = row ? JSON.parse(row.value) : [];
    reviews = saved.filter((review: Review & { published: boolean }) =>
      review?.published && typeof review.text === 'string' && review.text.trim() &&
      typeof review.name === 'string' && review.name.trim());
  } catch {
    return null;
  }
  if (!reviews.length) return null;

  return (
    <section className="studio-wrap salon-reviews" id="reviews" aria-labelledby="salon-review-title">
      <div className="review-spread">
        <div className="review-cover">
          <img src="/salon-team-480.webp" srcSet="/salon-team-480.webp 480w, /salon-team-960.webp 960w"
            sizes="(max-width: 720px) 90vw, (max-width: 1580px) 35vw, 550px" width={480} height={671} loading="lazy"
            alt="The Savannah Sky team together on the pink sofa in the salon" />
        </div>
        <div className="review-copy"><h2 id="salon-review-title">Studio <em>reviews.</em></h2>
          <StudioReview reviews={reviews} />
        </div>
      </div>
    </section>
  );
}
