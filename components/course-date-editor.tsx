'use client';
import {useState} from 'react';
import {parseSchedule} from '@/lib/course-schedule';

export default function CourseDateEditor({value}:{value?:string|null}) {
  const [schedule,setSchedule]=useState(()=>parseSchedule(value));
  return <div className="course-date-editor">
    <input type="hidden" name="courseDatesEditor" value="1"/>
    <p>Students choose from these dates before payment. All times are local to the academy in the UK. Past dates are hidden automatically.</p>
    <label>Public availability note<textarea maxLength={1000} rows={3} name="courseAvailabilityNote" defaultValue={schedule.message}
      placeholder="e.g. New dates will be released soon. Contact Carla to discuss another day."/></label>
    {schedule.dates.map((row,index)=><fieldset key={row.id} className="course-date-row"><legend>Course date {index+1}</legend><input type="hidden" name="courseDateId" value={row.id}/>
      <div className="ce-pair"><label>Date<input aria-label={'Course date '+(index+1)} type="date" required name="courseDateDay" defaultValue={row.date}/></label>
        <label>Availability<select name="courseDateStatus" defaultValue={row.status}><option value="available">Available</option><option value="full">Fully booked</option></select></label></div>
      <div className="ce-pair"><label>Start time<input type="time" required name="courseDateStart" defaultValue={row.start}/></label>
        <label>Finish time (optional)<input type="time" name="courseDateEnd" defaultValue={row.end}/></label></div>
      <label>Date note (optional)<input maxLength={200} name="courseDateNote" defaultValue={row.note} placeholder="e.g. Second day: 15 December, 10am–4pm"/></label>
      <button type="button" className="underlink" onClick={()=>setSchedule(s=>({...s,dates:s.dates.filter(date=>date.id!==row.id)}))}>Remove date {index+1}</button>
    </fieldset>)}
    <button type="button" className="button outline" disabled={schedule.dates.length>=60} onClick={()=>setSchedule(s=>({...s,dates:[...s.dates,{id:crypto.randomUUID(),date:'',start:'',end:'',status:'available',note:''}]}))}>Add course date</button>
    <p className="ce-public-hint">Mark dates fully booked when places are taken. These are preferred dates for Carla to confirm; places are not counted automatically. Changes here do not alter existing bookings. Contact booked students separately if a class changes.</p>
  </div>;
}
