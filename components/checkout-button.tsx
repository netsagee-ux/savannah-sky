'use client';
import {useNavigationAction} from '@/hooks/use-navigation-action';
import {useState} from 'react';
import {courseDateLabel,type CourseSchedule} from '@/lib/course-schedule';

export default function CheckoutButton({courseId,paypal=false,card=true,schedule,scheduled=false,signedIn=true,initialDate='',bookable=true,qualificationRequired=false}:{courseId:string;paypal?:boolean;card?:boolean;schedule?:CourseSchedule;scheduled?:boolean;signedIn?:boolean;initialDate?:string;bookable?:boolean;qualificationRequired?:boolean}){
  const {busy,begin,finish}=useNavigationAction();
  const [error,setError]=useState('');
  const [dateId,setDateId]=useState(schedule?.dates.some(row=>row.id===initialDate&&row.status==='available')?initialDate:'');
  const unavailable=scheduled&&!schedule?.dates.some(row=>row.status==='available');
  const selectedDate=schedule?.dates.find(row=>row.id===dateId&&row.status==='available');
  const needsDate=scheduled&&!selectedDate;
  const returnPath='/courses/'+encodeURIComponent(courseId)+(selectedDate?'?date='+encodeURIComponent(selectedDate.id):'')+'#enrol';
  async function start(provider:'sumup'|'paypal'){
    if(needsDate||unavailable)return;
    if(!begin())return;
    setError('');
    try {
      const response=await fetch('/api/checkout',{method:'POST',signal:AbortSignal.timeout?.(45000),headers:{'Content-Type':'application/json'},body:JSON.stringify({courseId,provider,dateId})});
      if(response.status===401){location.assign('/sign-in?redirect_url='+encodeURIComponent(returnPath));return;}
      const result=await response.json() as {path?:string;error?:string};
      if(!response.ok||!result.path)throw Error(result.error||'Please try again.');
      location.assign(result.path);
    } catch(e){setError((e as Error).message);finish();}
  }
  return <div className="course-booking-options">
    {schedule&&<><label htmlFor="course-date">Course date availability</label>
      <select id="course-date" value={selectedDate?.id||''} disabled={busy||!schedule.dates.length} aria-describedby="course-date-help" onChange={e=>{setDateId(e.target.value);setError('');}}>
        <option value="">{schedule.dates.length?'Choose your preferred date':scheduled?'New dates coming soon':'Arrange a date with Carla'}</option>
        {schedule.dates.map(row=><option key={row.id} value={row.id} disabled={row.status==='full'}>{courseDateLabel(row)}{row.status==='full'?' · Fully booked':''}</option>)}
      </select>
      {selectedDate&&<p className="course-availability-note">{courseDateLabel(selectedDate)}</p>}
      {schedule.message&&<p className="course-availability-note">{schedule.message}</p>}
      <p id="course-date-help">{unavailable?'There are no available dates to book at the moment. Contact Carla about the next class.':scheduled?'Your preferred date is saved with your booking. Carla will confirm your place.':'Dates are arranged directly with Carla. Contact her to agree a date before paying.'}</p></>}
    {bookable&&!unavailable&&(qualificationRequired?<p>Your qualification must be approved before payment.</p>:!signedIn?<a className="button" href={'/sign-in?redirect_url='+encodeURIComponent(returnPath)}>Sign in to book</a>:<>
      {card&&<button className="button" type="button" aria-busy={busy} disabled={busy||needsDate} onClick={()=>start('sumup')}>{busy?'Opening checkout…':paypal?'Pay by card':'Continue to payment'}</button>}
      {paypal&&<button className="button outline" type="button" disabled={busy||needsDate} onClick={()=>start('paypal')}>Pay with PayPal</button>}</>)}
    {unavailable&&<a className="underlink" href={'/contact?topic=dates&course='+encodeURIComponent(courseId)+'#ask'}>Ask about course dates</a>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
