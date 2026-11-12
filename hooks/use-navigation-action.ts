'use client';

import {useCallback,useEffect,useRef,useState} from 'react';

// Navigation keeps the action pending until the document changes. A restored
// browser history entry must be usable immediately when the learner returns.
export function useNavigationAction() {
  const inFlight=useRef(false);
  const [busy,setBusy]=useState(false);
  const finish=useCallback(()=>{
    inFlight.current=false;
    setBusy(false);
  },[]);
  useEffect(()=>{
    const restore=(event:PageTransitionEvent)=>{if(event.persisted)finish();};
    window.addEventListener('pageshow',restore);
    return ()=>window.removeEventListener('pageshow',restore);
  },[finish]);
  function begin(){
    if(inFlight.current)return false;
    inFlight.current=true;
    setBusy(true);
    return true;
  }
  return {begin,finish,busy};
}
