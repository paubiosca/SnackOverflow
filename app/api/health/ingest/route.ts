import { NextRequest, NextResponse } from 'next/server';
import {
  getUserIdByHealthToken,
  touchHealthToken,
  upsertDailyActivity,
} from '@/lib/db';

// Apple Health ingest endpoint. Called by an iOS Shortcut once a day with the
// user's Health summary. Auth via Bearer token (per-user, generated on Profile).
//
// Expected body:
//   {
//     "date": "YYYY-MM-DD",       // local-date for the user
//     "active_kcal": 482,
//     "bmr_kcal": 1620,
//     "total_kcal": 2102,         // optional; computed from active+bmr if absent
//     "steps": 8421,              // optional
//     "resting_hr": 58            // optional
//   }
//
// All numbers optional; the row is upserted on (user_id, date) so partial
// updates throughout the day are safe.

function getBearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

export async function POST(request: NextRequest) {
  const token = getBearer(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing Bearer token' }, { status: 401 });
  }
  const userId = await getUserIdByHealthToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const date: string | undefined = body?.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 });
  }

  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === '' ? null : Math.round(Number(v));

  const active = num(body.active_kcal);
  const bmr = num(body.bmr_kcal);
  const total = num(body.total_kcal) ?? (active != null && bmr != null ? active + bmr : null);
  const steps = num(body.steps);
  const restingHr = num(body.resting_hr);

  await upsertDailyActivity(userId, {
    date,
    activeKcal: active,
    bmrKcal: bmr,
    totalKcal: total,
    steps,
    restingHr,
    source: 'apple_health',
    raw: body,
  });
  await touchHealthToken(token);

  return NextResponse.json({ ok: true, date, active_kcal: active, bmr_kcal: bmr, total_kcal: total });
}
