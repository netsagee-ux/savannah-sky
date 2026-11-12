'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {Play,LockKeyhole} from 'lucide-react';

type Playback={url:string;expires:number;bookmark:string;seconds:number};
type Place={bookmark:string;seconds:number};

export default function PrivateVideo({lessonId,title,thumbnail}:{lessonId:string;title:string;thumbnail:boolean}){
  const [playback,setPlayback]=useState<Playback|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const place=useRef<Place|null>(null);
  const lastSent=useRef<Place|null>(null),lastAttempt=useRef(0);
  const queue=useRef<Promise<void>>(Promise.resolve());
  const ready=useRef(false),opening=useRef(false);

  const savePlace=useCallback(()=>{
    const current=place.current;
    if(!current || (lastSent.current?.bookmark===current.bookmark && lastSent.current.seconds===current.seconds))return;
    lastSent.current=current;
    queue.current=queue.current.then(async()=>{
      try{
        const response=await fetch('/api/progress',{method:'POST',signal:AbortSignal.timeout?.(15000),keepalive:true,headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'bookmark',lessonId,...current})});
        if(!response.ok)throw Error();
      }catch{
        if(lastSent.current===current)lastSent.current=null;
      }
    });
  },[lessonId]);

  useEffect(()=>{
    const hide=()=>{if(document.hidden)savePlace();};
    window.addEventListener('online',savePlace);
    window.addEventListener('pagehide',savePlace);
    document.addEventListener('visibilitychange',hide);
    return ()=>{window.removeEventListener('online',savePlace);window.removeEventListener('pagehide',savePlace);document.removeEventListener('visibilitychange',hide);savePlace();};
  },[savePlace]);

  async function open(){
    if(opening.current)return;
    opening.current=true;ready.current=false;setBusy(true);setError('');
    try{
      const response=await fetch('/api/video-access',{method:'POST',signal:AbortSignal.timeout?.(30000),headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId})});
      const result=await response.json() as Playback & {error?:string};
      if(!response.ok||!result.url)throw Error(result.error||'Unable to load video.');
      if(place.current?.bookmark===result.bookmark)result.seconds=place.current.seconds;
      place.current={bookmark:result.bookmark,seconds:result.seconds};
      lastAttempt.current=Date.now();
      setPlayback(result);
    }catch(reason){setPlayback(null);setError((reason as Error).message);}
    finally{opening.current=false;setBusy(false);}
  }
  function remember(element:HTMLVideoElement){
    if(!ready.current||!playback||!Number.isFinite(element.currentTime))return;
    place.current={bookmark:playback.bookmark,seconds:element.ended?0:Math.floor(element.currentTime)};
  }

  return <div className="private-player">
    {playback?<video controls autoPlay playsInline preload="metadata" controlsList="nodownload" aria-label={title}
      poster={thumbnail?'/api/thumbnail/'+lessonId:undefined} src={playback.url}
      onLoadedMetadata={event=>{
        const element=event.currentTarget;
        if(playback.seconds>0 && playback.seconds<element.duration)element.currentTime=playback.seconds;
        ready.current=true;
      }}
      onTimeUpdate={event=>{
        remember(event.currentTarget);
        if(Date.now()-lastAttempt.current>=30000){lastAttempt.current=Date.now();savePlace();}
      }}
      onPause={event=>{remember(event.currentTarget);savePlace();}}
      onEnded={event=>{remember(event.currentTarget);savePlace();}}
      onError={()=>{
        ready.current=false;savePlace();
        if(playback.expires*1000<=Date.now()){void open();return;}
        setPlayback(null);setError('Playback stopped. Reopen the video to continue from your last position.');
      }}/>:
      <button className="video-poster" aria-busy={busy} onClick={()=>void open()} disabled={busy} aria-label={'Play '+title}>
        {thumbnail&&<img src={'/api/thumbnail/'+lessonId} alt="" width={1280} height={720}/>}
        <span className="play-disc"><Play size={28}/></span><strong>{busy?'Checking access…':'Watch lesson'}</strong>
        <span><LockKeyhole size={14}/>Private course video</span>
      </button>}
    {error&&<p role="alert" className="notice">{error}</p>}
  </div>;
}
