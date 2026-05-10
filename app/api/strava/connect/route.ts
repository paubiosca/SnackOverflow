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
  const url = authorizationUrl(redirectUri, session.user.id);
  return NextResponse.json({ url });
}
