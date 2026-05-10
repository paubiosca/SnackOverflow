import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  listHealthTokens,
  getDailyActivity,
  getStravaKcalForDate,
  getStravaAccount,
} from '@/lib/db';

// Combined activity status used by the dashboard tile + BurnedCaloriesTile.
// Sources of "calories burned today":
//   - apple_health.totalKcal: basal + walking/incidental from iPhone
//   - strava.todayKcal: running/cycling kcal from Garmin via Strava
//
// We return BOTH separately AND a combined field, so callers can choose.

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const todayLocal = new Date().toISOString().slice(0, 10);

  const [tokens, today, stravaKcal, stravaAcct] = await Promise.all([
    listHealthTokens(userId),
    getDailyActivity(userId, todayLocal),
    getStravaKcalForDate(userId, todayLocal),
    getStravaAccount(userId),
  ]);

  const appleConnected = tokens.some((t) => !!t.lastUsedAt);
  const stravaConnected = !!stravaAcct;

  const appleActive = today?.activeKcal ?? null;
  const appleTotal = today?.totalKcal ?? null;
  const combinedActive = (appleActive ?? 0) + stravaKcal;
  const combinedTotal = appleTotal != null ? appleTotal + stravaKcal : null;

  return NextResponse.json({
    connected: appleConnected || stravaConnected,
    appleConnected,
    stravaConnected,
    today,
    stravaKcal,
    combined: {
      activeKcal: combinedActive,
      totalKcal: combinedTotal,
    },
  });
}
