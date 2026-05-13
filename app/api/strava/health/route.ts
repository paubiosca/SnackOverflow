import { NextResponse } from 'next/server';

// Config health probe for the Strava integration. Returns which required env
// vars are missing — without leaking the values — so the profile UI can warn
// loudly when prod is misconfigured instead of failing silently on the first
// webhook refresh ~6h after connect. Public endpoint (no auth) so it can be
// hit from anywhere, including curl, during a deploy.
//
// Curl from your laptop after each deploy:
//   curl https://<your-domain>/api/strava/health
//
// Healthy response is { ok: true, missing: [] }.

const REQUIRED = [
  'STRAVA_CLIENT_ID',
  'STRAVA_CLIENT_SECRET',
  'STRAVA_VERIFY_TOKEN',
  'NEXT_PUBLIC_APP_URL',
] as const;

export const dynamic = 'force-dynamic';

export async function GET() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  const ok = missing.length === 0;
  return NextResponse.json(
    {
      ok,
      missing,
      // The configured callback URL — useful to eyeball that Vercel's
      // NEXT_PUBLIC_APP_URL matches your Strava API callback domain.
      callbackUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/strava/callback`
        : null,
    },
    { status: ok ? 200 : 503 },
  );
}
