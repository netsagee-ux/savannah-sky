import type {ReactNode} from 'react';

export default function AuthFrame({children,signup=false}:{children:ReactNode;signup?:boolean}){
 return <section className="auth-frame">
  <div className="auth-story">
   <img src="/nail-floral-960.webp" alt="Delicate floral nail work by Savannah Sky" width={960} height={960}/>
   <div><span className="eyebrow">A little time for you</span><h1>{signup?'Your next chapter.':'Back to your craft.'}</h1><p>{signup?'A place to learn, practise and find your own style.':'Your lessons, your progress. Right where you left them.'}</p></div>
  </div>
  <div className="auth-form-panel">{children}<a className="auth-back" href="/courses">← Explore the courses</a></div>
 </section>;
}
