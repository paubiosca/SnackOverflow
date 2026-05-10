import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { upsertDailyActivity } from '@/lib/db';

// Browser-parsed Apple Health Export ZIP import. The user drags the export.zip
// into the import page, the browser parses + aggregates, then POSTs the small
// daily-summary array here. This route just upserts; all the heavy lifting is
// client-side so we sidestep Vercel's 4.5MB request limit on a 200MB export.

interface DailySummary {
  date?: unknown;
  active_kcal?: unknown;
  bmr_kcal?: unknown;
  steps?: unknown;
  resting_hr?: unknown;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Math.round(Number(v));

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const items: DailySummary[] = Array.isArray(body) ? (body as DailySummary[]) : [];
  if (items.length === 0) {
    return NextResponse.json({ error: 'Body must be a non-empty array' }, { status: 400 });
  }
  if (items.length > 5000) {
    return NextResponse.json({ error: 'Too many rows (max 5000)' }, { status: 400 });
  }

  let written = 0;
  const errors: string[] = [];

  // Sequential to avoid hammering Postgres on a 1825-row backfill (5 years).
  // 5000 upserts at ~5ms each is ~25s — well within Vercel's serverless limit.
  for (const item of items) {
    const date = typeof item.date === 'string' ? item.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Bad date: ${date}`);
      continue;
    }
    const active = num(item.active_kcal);
    const bmr = num(item.bmr_kcal);
    const total = active != null && bmr != null ? active + bmr : null;
    try {
      await upsertDailyActivity(userId, {
        date,
        activeKcal: active,
        bmrKcal: bmr,
        totalKcal: total,
        steps: num(item.steps),
        restingHr: num(item.resting_hr),
        source: 'apple_health_export',
        raw: null,
      });
      written++;
    } catch (e) {
      errors.push(`${date}: ${e instanceof Error ? e.message : 'upsert failed'}`);
    }
  }

  return NextResponse.json({
    ok: true,
    written,
    errorCount: errors.length,
    errors: errors.slice(0, 5),
  });
}

export const maxDuration = 60;
