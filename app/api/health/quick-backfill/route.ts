import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { upsertDailyActivity } from '@/lib/db';

// Dead-simple backfill: user types one number (their average daily active
// kcal) and we fill in the last N days with it. Imperfect — variance is
// flattened — but enough to make the calibration insight functional without
// any Shortcut, Apple Health export, or per-day data entry.
//
// Body:
//   {
//     "active_kcal": 450,        // required
//     "bmr_kcal": 1620,          // optional
//     "steps": 8000,             // optional
//     "days": 30                 // optional, default 30
//   }
//
// Auth: session (the user is on the website filling out a form).

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await request.json().catch(() => ({}));
  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Math.round(Number(v));

  const active = num(body?.active_kcal);
  const bmr = num(body?.bmr_kcal);
  const steps = num(body?.steps);
  const days = Math.min(90, Math.max(1, Number(body?.days ?? 30)));

  if (active == null || active < 0) {
    return NextResponse.json({ error: 'active_kcal is required and must be a non-negative number' }, { status: 400 });
  }

  // Build N daily rows ending today (UTC date — close enough for backfill purposes).
  const today = new Date();
  const writes: Promise<void>[] = [];
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    dates.push(date);
    const total = bmr != null ? active + bmr : null;
    writes.push(
      upsertDailyActivity(userId, {
        date,
        activeKcal: active,
        bmrKcal: bmr,
        totalKcal: total,
        steps,
        restingHr: null,
        source: 'manual_backfill',
        raw: { ...body, daysIndex: i },
      }),
    );
  }
  await Promise.all(writes);

  return NextResponse.json({ ok: true, written: writes.length, fromDate: dates[dates.length - 1], toDate: dates[0] });
}
