import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { Intro } from '@/components/ui';

export const metadata = { title: 'Contact & student support' };

export default function Contact() {
  return (
    <>
      <Intro kicker="Student support" title="Talk to the academy."
        text="Have a question about your first course or a technique you’re practising? Get in touch with Carla through the salon."
        image={{ src: '/salon-reception-960.webp', alt: 'The reception desk at Savannah Sky Salon' }} />
      <section className="studio-wrap support-directory" aria-label="Contact and learning links">
        <article><span className="overline">Contact Carla</span><h2>Send a message.</h2><p>Find Savannah Sky on Instagram or Facebook to ask about the training.</p>
          <a className="studio-text-link" href="https://www.instagram.com/savannahskyaromasandbeauty/" target="_blank" rel="noopener noreferrer">Instagram <ArrowUpRight size={16} /></a>
          <a className="studio-text-link" href="https://www.facebook.com/Savannahskyaromas/" target="_blank" rel="noopener noreferrer">Facebook <ArrowUpRight size={16} /></a></article>
        <article><span className="overline">Current students</span><h2>Your learning space.</h2><p>Pick up a lesson, check your progress or find an order.</p><a className="studio-text-link" href="/dashboard">My learning <ArrowRight size={16} /></a></article>
        <article><span className="overline">Before you enrol</span><h2>Course questions.</h2><p>Read about equipment, access and choosing the right course for you.</p><a className="studio-text-link" href="/faq">Read the FAQs <ArrowRight size={16} /></a><a className="studio-text-link" href="/courses">Explore courses <ArrowRight size={16} /></a></article>
      </section>
    </>
  );
}
