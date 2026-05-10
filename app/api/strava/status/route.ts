import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStravaAccount, getStravaKcalForDate } from '@/lib/db';
import { sql } from '@vercel/postgres';

// Combined Strava status for the profile UI + dashboard tile.
// Returns connection state, today's run kcal, and the last few activities.

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const today = new Date().toISOString().slice(0, 10);

  const [acct, todayKcal, recent] = await Promise.all([
    getStravaAccount(userId),
    getStravaKcalForDate(userId, today),
    sql`
      SELECT activity_type as "activityType", name, start_date as "startDate",
             date, moving_time_sec as "movingTimeSec",
             distance_m as "distanceM", kcal
      FROM strava_activities
      WHERE user_id = ${userId}
      ORDER BY start_date DESC
      LIMIT 10
    `,
  ]);

  return NextResponse.json({
    connected: !!acct,
    athleteId: acct?.athleteId ?? null,
    connectedAt: acct?.connectedAt ?? null,
    todayKcal,
    recent: recent.rows.map((r) => ({
      type: r.activityType,
      name: r.name,
      date: r.date,
      startDate: new Date(r.startDate).toISOString(),
      durationMin: r.movingTimeSec ? Math.round(Number(r.movingTimeSec) / 60) : null,
      distanceKm: r.distanceM ? Math.round(Number(r.distanceM) / 100) / 10 : null,
      kcal: r.kcal != null ? Number(r.kcal) : null,
    })),
  });
}
