import {db} from './server';
import {createHash} from 'node:crypto';
export type Qualification={status:'pending'|'approved'|'resubmit';course:string;email:string;proof?:string;mime?:string};
export const qualificationKey=(course:string,user:string)=>'qualification:'+createHash('sha256').update(JSON.stringify([course,user])).digest('hex');
export async function qualification(course:string,user:string){
  const row=await db().prepare('SELECT value FROM settings WHERE id=?').bind(qualificationKey(course,user)).first<{value:string}>();
  return row?JSON.parse(row.value) as Qualification:null;
}
