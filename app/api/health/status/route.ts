import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listHealthTokens, getDailyActivity } from '@/lib/db';

// Combined status for the dashboard tile + profile UI:
//   - whether the user has connected Apple Health (any token exists + has been used)
//   - today's daily_activity row (most recent ingest)

export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const todayLocal = new Date().toISOString().slice(0, 10);

  const [tokens, today] = await Promise.all([
    listHealthTokens(userId),
    getDailyActivity(userId, todayLocal),
  ]);

  // "Connected" = has at least one token that has actually received data.
  const connected = tokens.some((t) => !!t.lastUsedAt);

  return NextResponse.json({ connected, today });
}
