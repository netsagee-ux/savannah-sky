// The Vercel address and the academy domain have separate browser keys on the same Clerk instance.
export function academyAuthDomain(host: string | null) {
  const publicUrl = process.env.ACADEMY_PUBLIC_URL;
  const customKey = process.env.ACADEMY_CLERK_PUBLISHABLE_KEY;
  if (publicUrl && customKey && new URL(publicUrl).host === host) {
    // This domain has a Clerk CNAME. The Vercel-provided address uses a proxy.
    return { publishableKey: customKey, domain: new URL(publicUrl).hostname.replace(/^www\./, '') };
  }
  if (host === 'savannah-sky-k4rz-three.vercel.app' && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return { publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, proxyUrl: 'https://savannah-sky-k4rz-three.vercel.app/__clerk' };
  }
  return undefined;
}
