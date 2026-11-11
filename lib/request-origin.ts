// Next can reconstruct request.url with the server's internal hostname.
// The incoming Host identifies the site the browser actually addressed.
export function sameSiteOrigin(request:Request) {
  const origin=request.headers.get('origin');
  if(!origin)return false;
  const target=new URL(request.url);
  const host=request.headers.get('host')?.toLowerCase()||target.host;
  if(origin==='https://'+host)return true;
  return target.protocol==='http:' && process.env.VERCEL!=='1' && origin==='http://'+host;
}
