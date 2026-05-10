import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDailyActivityInRange } from '@/lib/db';

// Returns daily_activity rows in [start, end] for the current user.
// Used by the History page to fold per-day active burn into each day's goal.

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
  const days = await getDailyActivityInRange(session.user.id, start, end);
  return NextResponse.json({ days });
}
