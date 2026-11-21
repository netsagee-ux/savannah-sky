export type CourseDate = {id:string;date:string;start:string;end:string;status:'available'|'full';note:string};
export type CourseSchedule = {dates:CourseDate[];message:string};

export function parseSchedule(raw?:string|null):CourseSchedule {
  if(!raw)return {dates:[],message:''};
  const value=JSON.parse(raw);
  if(!value||!Array.isArray(value.dates)||value.dates.length>60||typeof value.message!=='string'||value.message.length>1000)
    throw Error('Add up to 60 course dates and keep the availability note within 1,000 characters.');
  const ids=new Set<string>(),times=new Set<string>();
  const dates=value.dates.map((row:CourseDate)=>{
    if(!row||typeof row.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(row.id)||ids.has(row.id))throw Error('Each course date needs its own reference. Reopen the editor.');
    if(typeof row.date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date))||new Date(row.date).toISOString().slice(0,10)!==row.date)
      throw Error('Choose a valid course date.');
    if(typeof row.start!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start)||typeof row.end!=='string'||(row.end&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end)||row.end<=row.start)))
      throw Error('Add a start time and an optional later finish time.');
    if(!['available','full'].includes(row.status)||typeof row.note!=='string'||row.note.length>200)throw Error('Check the date availability and keep its note within 200 characters.');
    const time=row.date+'T'+row.start;
    if(times.has(time))throw Error('This date and start time are listed twice.');
    ids.add(row.id);times.add(time);
    return {id:row.id,date:row.date,start:row.start,end:row.end,status:row.status,note:row.note.trim()};
  });
  dates.sort((a:CourseDate,b:CourseDate)=>(a.date+a.start).localeCompare(b.date+b.start));
  return {dates,message:value.message.trim()};
}

export function upcomingDates(schedule:CourseSchedule,now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const part=(name:string)=>parts.find(p=>p.type===name)!.value;
  const local=part('year')+'-'+part('month')+'-'+part('day')+'T'+part('hour')+':'+part('minute');
  return schedule.dates.filter(row=>row.date+'T'+row.start>local);
}

export function courseDateLabel(row:CourseDate) {
  const day=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(row.date+'T12:00:00Z'));
  return day+' · '+row.start+(row.end?'–'+row.end:'')+' (UK time)'+(row.note?' · '+row.note:'');
}

// Native form values are the source of truth, including date/time controls on mobile.
export function scheduleFromForm(form:FormData):CourseSchedule {
  if(!form.has('courseDatesEditor'))return parseSchedule(String(form.get('courseSchedule')||''));
  const column=(name:string)=>form.getAll(name).map(value=>String(value).trim());
  const ids=column('courseDateId'),days=column('courseDateDay'),starts=column('courseDateStart'),ends=column('courseDateEnd'),statuses=column('courseDateStatus'),notes=column('courseDateNote');
  if([days,starts,ends,statuses,notes].some(values=>values.length!==ids.length))throw Error('Reopen the course dates editor and try again.');
  return parseSchedule(JSON.stringify({message:String(form.get('courseAvailabilityNote')||''),dates:ids.map((id,i)=>({id,date:days[i],start:starts[i],end:ends[i],status:statuses[i],note:notes[i]}))}));
}
