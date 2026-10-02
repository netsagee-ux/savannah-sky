export type Course={id:string;title:string;description:string;level:string;price:number|null;payment_url?:string|null;thumbnail_key?:string|null;published?:number;outcomes?:string|null;requirements?:string|null;duration?:string|null;access_policy?:string|null;thumbnail_id?:string|null;preview?:boolean};
export const previews:Course[]=[
{id:'gel-foundations',title:'Gel Polish Foundations',description:'Preparation, gel application and a clean finish. A proposed starting point for learners new to gel polish.',level:'Beginner',price:null,preview:true},
{id:'builder-gel',title:'Builder Gel Technique',description:'A closer look at structure, shaping and builder gel application. Ask us about the training required before joining.',level:'Intermediate',price:null,preview:true},
{id:'nail-art',title:'Modern Nail Art',description:'French tips, fine lines and colour work. A proposed course for practising the smaller details of a finished set.',level:'Creative',price:null,preview:true}];
