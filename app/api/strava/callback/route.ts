import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { exchangeCodeForToken } from '@/lib/strava/client';
import { upsertStravaAccount } from '@/lib/db';

// Strava redirects here after the user grants/denies access on its OAuth page.
// We exchange the authorization code for tokens, persist them, and bounce the
// user back to /profile with a success/failure flag.

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // State must match the session user.id we set in /connect — guards against
  // someone landing here with a stale or attacker-crafted code for another account.
  if (error || !code || state !== session.user.id) {
    return NextResponse.redirect(new URL('/profile?strava=denied', request.url));
  }

  try {
    const token = await exchangeCodeForToken(code);
    if (!token.athlete?.id) throw new Error('Token response missing athlete.id');
    await upsertStravaAccount(session.user.id, {
      athleteId: token.athlete.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(token.expires_at * 1000),
      scope: 'read,activity:read',
    });
    return NextResponse.redirect(new URL('/profile?strava=connected', request.url));
  } catch (err) {
    console.error('[strava/callback] error:', err);
    return NextResponse.redirect(new URL('/profile?strava=failed', request.url));
  }
}
