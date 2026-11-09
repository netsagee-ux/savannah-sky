const tabs=['Courses','Lessons','Students','Enquiries','Reviews','Payments','Shop'];

export function staffDestination(value?:string){
  if(typeof value!=='string' || !value.startsWith('/admin') || value.length>300)return '/admin?tab=Lessons';
  const url=new URL(value,'https://academy.local');
  if(url.origin!=='https://academy.local')return '/admin?tab=Lessons';
  if(url.pathname==='/admin/staff')return '/admin/staff';
  if(url.pathname!=='/admin')return '/admin?tab=Lessons';
  const tab=url.searchParams.get('tab');
  if(!tab||!tabs.includes(tab))return '/admin';
  const params=new URLSearchParams({tab});
  const course=url.searchParams.get('courseId');
  if(tab==='Lessons'&&course&&/^[a-zA-Z0-9_-]{1,128}$/.test(course))params.set('courseId',course);
  return '/admin?'+params;
}
