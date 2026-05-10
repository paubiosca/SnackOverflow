import { NextRequest, NextResponse } from 'next/server';
import {
  getStravaAccountByAthleteId,
  upsertStravaAccount,
  upsertStravaActivity,
  deleteStravaActivity,
} from '@/lib/db';
import {
  refreshAccessToken,
  getActivityDetail,
  bestKcal,
} from '@/lib/strava/client';

// Strava webhook handlers.
//
// GET  — subscription verification handshake. Strava sends ?hub.mode=subscribe
//        &hub.verify_token=...&hub.challenge=... and we must echo the challenge
//        if the token matches our STRAVA_VERIFY_TOKEN env var.
//
// POST — activity events. Body: { object_type, object_id, aspect_type, owner_id,
//        subscription_id, event_time, updates? }. We resolve owner_id (athlete_id)
//        to our user, fetch the activity (or skip if it was deleted), and upsert.

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === process.env.STRAVA_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': challenge });
  }
  return NextResponse.json({ error: 'verification failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const event = await request.json().catch(() => null);
  if (!event) return NextResponse.json({ ok: true });

  // Only care about activity events.
  if (event.object_type !== 'activity') return NextResponse.json({ ok: true });

  const ownerId: number | undefined = event.owner_id;
  const activityId: number | undefined = event.object_id;
  const aspect: string | undefined = event.aspect_type;
  if (!ownerId || !activityId || !aspect) return NextResponse.json({ ok: true });

  const acct = await getStravaAccountByAthleteId(ownerId);
  if (!acct) {
    // Unknown athlete — likely a race between connect/webhook arrival.
    // Just ack so Strava doesn't retry forever.
    return NextResponse.json({ ok: true });
  }

  if (aspect === 'delete') {
    await deleteStravaActivity(acct.userId, activityId);
    return NextResponse.json({ ok: true });
  }

  // create or update — fetch the latest detail (refresh token if needed).
  const expiresMs = new Date(acct.expiresAt).getTime();
  let token = acct.accessToken;
  if (expiresMs - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(acct.refreshToken);
      await upsertStravaAccount(acct.userId, {
        athleteId: acct.athleteId,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: new Date(refreshed.expires_at * 1000),
        scope: acct.scope,
      });
      token = refreshed.access_token;
    } catch (err) {
      console.error('[strava/webhook] refresh failed for athlete', ownerId, err);
      return NextResponse.json({ ok: true });
    }
  }

  try {
    const a = await getActivityDetail(token, activityId);
    const kcal = bestKcal(a);
    const startIso = a.start_date_local ?? a.start_date;
    await upsertStravaActivity(acct.userId, {
      stravaActivityId: a.id,
      activityType: a.sport_type ?? a.type,
      name: a.name ?? null,
      startDate: new Date(a.start_date),
      date: startIso.slice(0, 10),
      movingTimeSec: a.moving_time ?? null,
      distanceM: a.distance != null ? Math.round(a.distance) : null,
      kcal,
      raw: a,
    });
  } catch (err) {
    console.error('[strava/webhook] detail fetch failed for', activityId, err);
  }

  return NextResponse.json({ ok: true });
}
