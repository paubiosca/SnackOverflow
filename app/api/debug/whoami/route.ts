import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@vercel/postgres';

// Auth-gated diagnostic that answers "is prod looking at the right user in the
// right database". Returns:
//   - session.user.id (from the JWT cookie this request carries)
//   - whether a users row exists for that id, and its email
//   - the row count + latest date in food_entries for that user
//   - the DB host / database name actually being queried
// No secrets, no other users' data — only the caller's. Safe to leave deployed
// while we're diagnosing; the response is gated by auth.

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { authenticated: false, hint: 'Open /login first; this only works for a signed-in session.' },
      { status: 401 },
    );
  }

  const sessionUserId = session.user.id;

  const u = await sql`SELECT id, email, created_at::text AS created FROM users WHERE id = ${sessionUserId}`;
  const fe = await sql`
    SELECT COUNT(*)::int AS n,
           MIN(date)::text AS earliest,
           MAX(date)::text AS latest,
           COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '7 days')::int AS last7
    FROM food_entries
    WHERE user_id = ${sessionUserId}
  `;
  const usersTotal = await sql`SELECT COUNT(*)::int AS n FROM users`;
  const db = await sql`SELECT current_database() AS db, inet_server_addr()::text AS addr, current_setting('TimeZone') AS tz`;

  // Per-day counts for the last 7 days — so the response shows exactly which
  // dates have data. Mirrors what the history page builds its window over.
  const byDay = await sql`
    SELECT date::text AS date, COUNT(*)::int AS n
    FROM food_entries
    WHERE user_id = ${sessionUserId}
    AND date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY date ORDER BY date DESC
  `;

  // What the Node process running this request thinks "today" is, both UTC
  // and "local" (which on Vercel is UTC because TZ defaults to UTC).
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayUtc = now.toISOString().slice(0, 10);

  return NextResponse.json({
    authenticated: true,
    sessionUserId,
    userInDb: u.rows[0] ?? null,
    foodEntries: fe.rows[0],
    last7DaysByDate: byDay.rows,
    usersInThisDatabase: usersTotal.rows[0].n,
    database: db.rows[0],
    sessionEmail: session.user.email ?? null,
    nodeNowIso: now.toISOString(),
    nodeTodayLocal: todayLocal,
    nodeTodayUtc: todayUtc,
    nodeTz: process.env.TZ ?? '(unset; default UTC on Vercel)',
  });
}
