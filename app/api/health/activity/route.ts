import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDailyActivityInRange, getStravaKcalByDate } from '@/lib/db';

// Per-day activity rows in [start, end] for the current user. Combines
// Apple Health daily totals (basal + walking) with Strava run kcal so the
// history page can compute today's target = baseline + run - deficit
// without a second round-trip.

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required (YYYY-MM-DD)' }, { status: 400 });
  }

  const userId = session.user.id;
  const [appleDays, stravaByDate] = await Promise.all([
    getDailyActivityInRange(userId, start, end),
    getStravaKcalByDate(userId, start, end),
  ]);

  const stravaMap = new Map(stravaByDate.map((d) => [d.date, d.kcal]));
  const days = appleDays.map((d) => ({ ...d, stravaKcal: stravaMap.get(d.date) ?? 0 }));

  // If a date has Strava data but no Apple Health row, surface it anyway so
  // the history page sees the run kcal even on days without Health data.
  const present = new Set(appleDays.map((d) => d.date));
  for (const s of stravaByDate) {
    if (!present.has(s.date)) {
      days.push({
        date: s.date,
        activeKcal: null,
        bmrKcal: null,
        totalKcal: null,
        steps: null,
        restingHr: null,
        stravaKcal: s.kcal,
      });
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ days });
}
