import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/lib/auth.config';

// Edge-only NextAuth instance — built from the slice in auth.config.ts which
// has no DB or bcrypt imports. The full instance lives in lib/auth.ts for API
// routes and server components.
const { auth } = NextAuth(authConfig);

// Global auth gate. Runs before every page and API request. Anything not
// explicitly listed as public is redirected to /login (for browser navigations)
// or returned as 401 JSON (for API calls).
//
// Public lists are deliberately small. If you need to add a route here, ask:
// is the route entirely external-callable (e.g. an inbound webhook), or is it
// a diagnostic that's safe to expose? Otherwise leave it behind the gate.

// Browser-facing routes that must work without a session.
const PUBLIC_PAGES = new Set<string>([
  '/login',
  '/register',
]);

// API/route-handler prefixes that must accept anonymous requests:
//  - /api/auth/*   : NextAuth's own handlers (sign-in, callback, csrf, etc.)
//  - /api/strava/webhook   : Strava posts here from its servers, no cookie.
//  - /api/strava/callback  : OAuth redirect-back. Route handles its own auth
//                            check; gating it here would discard the OAuth
//                            `code` query param when bouncing to /login.
//  - /api/health/env, /api/strava/health : diagnostic probes (names only,
//                            no values). Public on purpose so you can curl
//                            them from any browser after a deploy.
const PUBLIC_API_PREFIXES = [
  '/api/auth',
  '/api/strava/webhook',
  '/api/strava/callback',
  '/api/health/env',
  '/api/strava/health',
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return true;
  }
  return false;
}

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = !!req.auth?.user?.id;

  if (isPublic(path)) {
    // If already signed in, bounce the auth pages back to the app — no point
    // showing /login to a logged-in user.
    if (isLoggedIn && PUBLIC_PAGES.has(path)) {
      return NextResponse.redirect(new URL('/add-food', req.url));
    }
    return NextResponse.next();
  }

  if (isLoggedIn) return NextResponse.next();

  // API → 401 JSON so fetch() callers can react. Browser navigation → /login.
  if (path.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  // Preserve where the user was going so /login can send them back after sign-in.
  if (path !== '/') loginUrl.searchParams.set('next', path + nextUrl.search);
  return NextResponse.redirect(loginUrl);
});

// Run on everything except Next.js internals and obvious static asset URLs.
// Anything with a dot in the last segment (e.g. /logo.png, /favicon.ico) is
// considered a static file and skipped.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
