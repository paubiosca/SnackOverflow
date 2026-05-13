import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { authorizationUrl } from '@/lib/strava/client';

// Kick off the Strava OAuth flow. Returns the authorize URL; the client
// performs the redirect (this keeps Vercel from doing a 302 which can confuse
// fetch). The session user.id is encoded in `state` so the callback can
// associate the new account with the right user.

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri = `${base}/api/strava/callback`;
  try {
    const url = authorizationUrl(redirectUri, session.user.id);
    return NextResponse.json({ url });
  } catch (err) {
    // requireEnv throws when STRAVA_CLIENT_ID is missing. Without this catch
    // the client just sees a generic 500 and the alert reads "Connect failed",
    // which is exactly the case where you most need to know which env is missing.
    const message = err instanceof Error ? err.message : 'Strava is not configured';
    console.error('[strava/connect]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
