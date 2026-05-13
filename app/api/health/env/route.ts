import { NextResponse } from 'next/server';

// Env-health probe for the running deploy. Lists which required env vars are
// missing — names only, never values — so a misconfigured production deploy
// is one curl away from being diagnosed. Public endpoint by design: the names
// alone aren't secrets, and the diagnostic value of being able to hit this
// from any browser outweighs the (negligible) info leak of confirming which
// integrations the app uses.
//
// Curl after any redeploy:
//   curl https://<your-domain>/api/health/env
// Healthy is { ok: true, missing: { critical: [], optional: [] } }.

// Without these the app cannot read its own data; UIs render empty.
const CRITICAL = [
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const;

// Integrations whose absence breaks specific features but not the whole app.
const OPTIONAL = [
  'NEXT_PUBLIC_APP_URL',
  'STRAVA_CLIENT_ID',
  'STRAVA_CLIENT_SECRET',
  'STRAVA_VERIFY_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'OPENAI_API_KEY',
] as const;

export const dynamic = 'force-dynamic';

export async function GET() {
  const missingCritical = CRITICAL.filter((n) => !process.env[n]);
  const missingOptional = OPTIONAL.filter((n) => !process.env[n]);
  const ok = missingCritical.length === 0;
  return NextResponse.json(
    {
      ok,
      missing: { critical: missingCritical, optional: missingOptional },
      // Sanity-print of host bits so you can confirm the deploy is reading the
      // env scope you think it's reading. Values are derived from URL strings
      // only, never raw secrets.
      info: {
        hasDatabase: !!process.env.POSTGRES_URL,
        postgresHost: process.env.POSTGRES_HOST ?? null,
        nextauthUrl: process.env.NEXTAUTH_URL ?? null,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
        vercelEnv: process.env.VERCEL_ENV ?? null,
        vercelUrl: process.env.VERCEL_URL ?? null,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
