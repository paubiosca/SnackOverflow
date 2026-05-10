import { NextRequest, NextResponse } from 'next/server';
import {
  getUserIdByHealthToken,
  touchHealthToken,
  upsertDailyActivity,
} from '@/lib/db';

// Apple Health ingest endpoint. Called by an iOS Shortcut. Auth via Bearer
// token (per-user, generated on Profile).
//
// Body can be either a single day or an array of days for backfill:
//   { "date": "2026-05-10", "active_kcal": 482, "bmr_kcal": 1620, ... }
//   [ { "date": "2026-05-09", ... }, { "date": "2026-05-10", ... } ]
//
// All numeric fields except `date` are optional. Rows are upserted on
// (user_id, date) so partial updates and re-runs are safe.

interface DailyInput {
  date?: unknown;
  active_kcal?: unknown;
  bmr_kcal?: unknown;
  total_kcal?: unknown;
  steps?: unknown;
  resting_hr?: unknown;
}

interface ProcessedRow {
  date: string;
  active_kcal: number | null;
  bmr_kcal: number | null;
  total_kcal: number | null;
  steps: number | null;
  resting_hr: number | null;
  raw: unknown;
}

function getBearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? null;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Math.round(Number(v));

function processRow(item: DailyInput): ProcessedRow | { error: string } {
  const date = typeof item.date === 'string' ? item.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: `Invalid or missing date: ${date}` };
  const active = num(item.active_kcal);
  const bmr = num(item.bmr_kcal);
  const total = num(item.total_kcal) ?? (active != null && bmr != null ? active + bmr : null);
  return {
    date,
    active_kcal: active,
    bmr_kcal: bmr,
    total_kcal: total,
    steps: num(item.steps),
    resting_hr: num(item.resting_hr),
    raw: item,
  };
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Normalize: accept either a single object or an array of objects.
  const items: DailyInput[] = Array.isArray(body) ? (body as DailyInput[]) : [body as DailyInput];
  if (items.length === 0) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 });
  }
  if (items.length > 400) {
    return NextResponse.json({ error: 'Too many rows in one request (max 400)' }, { status: 400 });
  }

  const processed: ProcessedRow[] = [];
  const errors: string[] = [];
  for (const item of items) {
    const result = processRow(item);
    if ('error' in result) errors.push(result.error);
    else processed.push(result);
  }

  // Upsert in parallel — each row is independent and the DB indexes are tight.
  await Promise.all(
    processed.map((row) =>
      upsertDailyActivity(userId, {
        date: row.date,
        activeKcal: row.active_kcal,
        bmrKcal: row.bmr_kcal,
        totalKcal: row.total_kcal,
        steps: row.steps,
        restingHr: row.resting_hr,
        source: 'apple_health',
        raw: row.raw,
      }),
    ),
  );
  await touchHealthToken(token);

  return NextResponse.json({
    ok: true,
    written: processed.length,
    errors: errors.length ? errors : undefined,
    dates: processed.map((p) => p.date),
  });
}
