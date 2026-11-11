export type Course={id:string;title:string;description:string;level:string;price:number|null;cpd?:number|string|null;payment_url?:string|null;thumbnail_key?:string|null;published?:number;outcomes?:string|null;requirements?:string|null;duration?:string|null;access_policy?:string|null;thumbnail_id?:string|null;format?:string;class_dates?:string;audience?:string|null;inclusions?:string|null;kit_options?:string|null;progression?:string|null;preview?:boolean};
export const previews:Course[]=[
{id:'gel-foundations',title:'Gel Polish Foundations',description:'Preparation, gel application and a clean finish. A starting point for learning gel polish.',level:'Beginner',price:null,preview:true},
{id:'builder-gel',title:'Builder Gel Technique',description:'A closer look at structure, shaping and builder gel application. Start from the basics.',level:'Beginner',price:null,preview:true},
{id:'nail-art',title:'Modern Nail Art',description:'French tips, fine lines and colour work. Practise the smaller details of a finished set.',level:'Beginner',price:null,preview:true}];

const accreditedCourses=new Set(['gel-foundations','builder-gel','nail-art','680c0c43-62fa-4694-9e76-275a43282d74',
 '7fed4d8e-8b53-4834-b2c7-7df0f8583fbc','f34bb22b-697f-4be7-806a-ea8a6fc69f56','bdba3ef1-ee4b-4bd2-9c46-7c1886e371b5']);
export function accredited(course:{id:string;cpd?:number|string|null}){
 return course.cpd==null?accreditedCourses.has(course.id):Number(course.cpd)===1;
}

const gbp = new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'});
export function courseFee(pence:number){
  return gbp.format(pence/100).replace(/\.00$/,'');
}

export function courseSummary(description:string){
  const opening=description.trim().split(/\r?\n/)[0];
  if(opening.length<=190)return opening;
  const lead=opening.slice(0,190);
  const sentence=lead.match(/^.*[.!?](?=\s|$)/);
  return sentence?.[0] || lead.slice(0,lead.lastIndexOf(' ')>0?lead.lastIndexOf(' '):190).trimEnd()+'…';
}

const conversionCourses=new Set(['f34bb22b-697f-4be7-806a-ea8a6fc69f56','7fed4d8e-8b53-4834-b2c7-7df0f8583fbc']);
export function isConversion(course:{id:string;title:string;level?:string}){
  return conversionCourses.has(course.id)||course.level==='Conversion'||/\bconversion\b/i.test(course.title);
}
