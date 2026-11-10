import {staffDestination} from './staff-navigation';

const customerPage=/^\/(?:courses(?:\/[\w-]+)?|learn\/[\w-]+|certificate\/[\w-]+|orders\/[\w-]+(?:\/learn)?|shop(?:\/orders(?:\/[\w-]+)?)?|payment-result)$/;

// Preserve a checkout or paid lesson across login, but never route to an arbitrary URL or API.
export function accountReturn(value:unknown){
  if(typeof value!=='string'||value.length>2000||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return '/dashboard';
  try{
    const url=new URL(value,'https://academy.local');
    if(url.origin!=='https://academy.local')return '/dashboard';
    if(url.pathname==='/admin')return staffDestination(url.pathname+url.search);
    if(customerPage.test(url.pathname))return url.pathname+url.search+url.hash;
  }catch{}
  return '/dashboard';
}

export function accountLanding(isOwner:boolean,requested:unknown){
  const path=accountReturn(requested);
  const workspace=path==='/admin'||path.startsWith('/admin?');
  if(isOwner)return workspace?path:'/admin';
  return workspace?'/dashboard':path;
}

export function accountContinue(requested:unknown){
  const path=accountReturn(requested);
  return path==='/dashboard'?'/account/continue':'/account/continue?next='+encodeURIComponent(path);
}
