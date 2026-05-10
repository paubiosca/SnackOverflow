import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getStravaAccount,
  upsertStravaAccount,
  upsertStravaActivity,
} from '@/lib/db';
import {
  refreshAccessToken,
  listActivities,
  getActivityDetail,
  bestKcal,
  StravaActivity,
} from '@/lib/strava/client';

// Backfill the user's Strava activities for the last `days` days (default 90).
// Refreshes the access token if expired, paginates, and falls back to the
// detail endpoint when the summary is missing kcal.

export const maxDuration = 60;

async function freshAccessToken(userId: string): Promise<string> {
  const acct = await getStravaAccount(userId);
  if (!acct) throw new Error('No Strava account connected');
  const expiresMs = new Date(acct.expiresAt).getTime();
  // Refresh 5 minutes before expiry to be safe.
  if (expiresMs - Date.now() > 5 * 60 * 1000) return acct.accessToken;

  const refreshed = await refreshAccessToken(acct.refreshToken);
  await upsertStravaAccount(userId, {
    athleteId: acct.athleteId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: new Date(refreshed.expires_at * 1000),
    scope: acct.scope,
  });
  return refreshed.access_token;
}

function localDate(iso: string): string {
  // Strava's start_date is UTC; start_date_local is the athlete's local time.
  // We use the local date for grouping ("did Pau run today?") which matches
  // how the user mentally bins their runs.
  return iso.slice(0, 10);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json().catch(() => ({}));
  const days = Math.min(365, Math.max(1, Number(body?.days ?? 90)));
  const after = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

  let token: string;
  try {
    token = await freshAccessToken(userId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Token error' },
      { status: 400 },
    );
  }

  const all: StravaActivity[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await listActivities(token, { after, perPage: 100, page });
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }

  let written = 0;
  let detailFetches = 0;
  for (const a of all) {
    let kcal = bestKcal(a);
    // For runs, the summary often omits calories. The detail endpoint usually has them.
    if (kcal == null && (a.type === 'Run' || a.sport_type === 'Run')) {
      try {
        const detail = await getActivityDetail(token, a.id);
        kcal = bestKcal(detail);
        detailFetches++;
      } catch (err) {
        // Tolerate per-activity failures — keep going.
        console.error('[strava/backfill] detail fetch failed for', a.id, err);
      }
    }
    const startIso = a.start_date_local ?? a.start_date;
    await upsertStravaActivity(userId, {
      stravaActivityId: a.id,
      activityType: a.sport_type ?? a.type,
      name: a.name ?? null,
      startDate: new Date(a.start_date),
      date: localDate(startIso),
      movingTimeSec: a.moving_time ?? null,
      distanceM: a.distance != null ? Math.round(a.distance) : null,
      kcal: kcal,
      raw: a,
    });
    written++;
  }

  return NextResponse.json({
    ok: true,
    fetched: all.length,
    written,
    detailFetches,
    days,
  });
}
