import { ArrowUpRight } from 'lucide-react';
import ContactForm from '@/components/contact-form';
import { Intro } from '@/components/ui';

export const metadata = { title: 'Contact & student support' };

export default async function Contact({ searchParams }: { searchParams: Promise<{ course?: string | string[] }> }) {
  const { course } = await searchParams;
  const title = typeof course === 'string' ? course.trim().slice(0, 160) : '';
  const canSave = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
  return <>
    <Intro kicker="Student support" title="Student support."
      image={{ src: '/salon-reception-960.webp', smallSrc: '/salon-reception-480.webp', alt: 'The reception desk at Savannah Sky Salon' }} />
    <section id="ask" className="studio-wrap enquiry-layout" aria-labelledby="ask-title">
      <div className="enquiry-intro"><h2 id="ask-title">{title ? 'Ask about ' + title : 'What would you like to learn?'}</h2>
        <p>{canSave ? 'Send a note to the academy or message the salon directly.' : 'Message Carla through the salon for course dates, kit advice or help choosing your training.'}</p>
        <a className="studio-text-link" href="https://www.instagram.com/savannahskyaromasandbeauty/" target="_blank" rel="noopener noreferrer">Instagram <ArrowUpRight size={15} /></a>
        <a className="studio-text-link" href="https://www.facebook.com/Savannahskyaromas/" target="_blank" rel="noopener noreferrer">Facebook <ArrowUpRight size={15} /></a>
      </div>
      {canSave && <ContactForm course={title} />}
    </section>
  </>;
}
