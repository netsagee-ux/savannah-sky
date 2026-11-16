import {journalPosts} from '@/lib/journal';
import './journal.css';
export const metadata={title:'Academy journal'};
export const dynamic='force-dynamic';
export default async function Journal(){
  const posts=await journalPosts();
  return <section className="studio-wrap academy-journal"><h1>Academy journal</h1>
    {posts.length?posts.map(post=><article key={post.id} id={post.id}>
      <time dateTime={post.date}>{new Intl.DateTimeFormat('en-GB',{dateStyle:'long',timeZone:'Europe/London'}).format(new Date(post.date))}</time>
      <h2>{post.title}</h2>
      {post.body.split(/\n\s*\n/).map((paragraph,index)=><p key={index}>{paragraph}</p>)}
    </article>):<p>Course notes and studio updates will appear here.</p>}
  </section>;
}
